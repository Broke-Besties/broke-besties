// PayPal connect + pay (specs/backend.md Part B). Exported types, method
// signatures and the JSDoc on each method are the contract the routes and web
// UI code against (docs/superpowers/plans/2026-10-03-backend-and-paypal.md).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  amountToCents,
  centsToAmount,
  checkoutUrl,
  decodeStateUnverified,
  exchangeAuthorizationCode,
  fetchUserInfo,
  getAppUrl,
  getPaypalCredentials,
  getWebhookId,
  isAppScheme,
  paypalFetch,
  paypalWebBase,
  schemeForVariant,
  signState,
  verifyState,
} from "@/lib/paypal";
import { PaypalConfigError, PaypalError, PaypalFlowError } from "@/lib/paypal-errors";
import { PaypalPolicy } from "@/policies";
import { emailService } from "./email.service";

const CONNECT_SCOPES = "openid email https://uri.paypal.com/services/paypalattributes";
const ORDER_RESUMABLE_MS = 3 * 60 * 60 * 1000;
const ORDER_CREATION_MS = 2 * 60 * 1000;

/** The parts of a PayPal order (Orders v2) we read. */
type PaypalOrder = {
  id?: string;
  links?: { rel?: string; href?: string }[];
  purchase_units?: {
    payee?: PaypalCapture["payee"];
    payments?: { captures?: PaypalCapture[] };
  }[];
};

function describeError(error: unknown): string {
  if (error instanceof PaypalError) {
    return `${error.issue ?? error.paypalName} (HTTP ${error.status}, debug id ${error.debugId ?? "none"})`;
  }
  return error instanceof Error ? error.message : String(error);
}

const hasIssue = (error: PaypalError, issue: string) => error.details.some((d) => d.issue === issue);

/**
 * PayPal may or may not have captured: server errors, auth/rate limits, and a racing request
 * with the same PayPal-Request-Id (the client capture vs the CHECKOUT.ORDER.APPROVED webhook).
 */
function captureOutcomeUnknown(error: unknown): boolean {
  return (
    !(error instanceof PaypalError) ||
    error.status >= 500 ||
    [401, 408, 409, 429].includes(error.status) ||
    ["PREVIOUS_REQUEST_IN_PROGRESS", "DUPLICATE_REQUEST_ID", "PAYPAL_REQUEST_ID_PREVIOUSLY_USED"].some(
      (issue) => hasIssue(error, issue),
    )
  );
}

/** Email fields shared by the received/refunded emails. */
function paymentEmail(payment: {
  amountCents: number;
  debtId: number | null;
  payer: { name: string; email: string };
  payee: { name: string; email: string };
  debt: { description: string | null } | null;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    borrowerName: payment.payer.name || payment.payer.email,
    lenderName: payment.payee.name || payment.payee.email,
    amount: payment.amountCents / 100,
    description: payment.debt?.description ?? null,
    debtLink: payment.debtId ? `${baseUrl}/debts/${payment.debtId}` : `${baseUrl}/debts`,
  };
}

/** The parts of a webhook resource (order, capture or refund) used to find our payment. */
type WebhookResource = PaypalCapture & {
  purchase_units?: { custom_id?: string }[];
  supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
  links?: { rel?: string; href?: string }[];
};

const WEBHOOK_EVENTS = [
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.PENDING",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
];

const paymentWithPartiesInclude = {
  payer: { select: { name: true, email: true } },
  payee: { select: { name: true, email: true } },
  debt: { select: { description: true } },
} satisfies Prisma.PaypalPaymentInclude;

/** NEXT_PUBLIC_APP_URL, or "" so redirects stay relative (the routes resolve them). */
function appUrlOrRelative(): string {
  try {
    return getAppUrl();
  } catch {
    return "";
  }
}

const isTrue = (value: unknown) => value === true || value === "true";

export type PaypalPlatform = "web" | "ios";

export type PaypalPaymentStatus =
  | "CREATED"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "REFUNDED";

/** `GET /api/paypal/account` → `{ account: PaypalAccountInfo | null }` */
export type PaypalAccountInfo = {
  email: string;
  emailVerified: boolean;
  connectedAt: Date;
};

export type PaypalPaymentInfo = {
  id: string;
  status: PaypalPaymentStatus;
  amountCents: number;
  createdAt: Date;
  completedAt: Date | null;
};

/** The `paypal` block of `GET /api/debts/:id`. */
export type DebtPaypalInfo = {
  lenderConnected: boolean;
  /**
   * Viewer is the borrower, canPayDebt(...) holds, the lender connected PayPal, and no
   * payment is APPROVED (a pending capture: money already in flight).
   */
  canPay: boolean;
  /** Every PayPal payment for the debt, newest first. */
  payments: PaypalPaymentInfo[];
};

/** The debt fields the PayPal helpers need. */
export type PayableDebt = {
  id: number;
  lenderId: string;
  borrowerId: string;
  status: string;
};

export const debtWithPartiesInclude = {
  lender: { select: { id: true, email: true, name: true } },
  borrower: { select: { id: true, email: true, name: true } },
  group: { select: { id: true, name: true } },
  receipts: true,
} satisfies Prisma.DebtInclude;

/** Same shape as an item of `GET /api/debts`. */
export type DebtWithParties = Prisma.DebtGetPayload<{
  include: typeof debtWithPartiesInclude;
}>;

/**
 * `POST /api/paypal/payments/:id/capture`:
 * 200 → `{ payment, debt }`, 202 → `{ payment }` (PayPal is still processing).
 */
export type CaptureResult =
  | { httpStatus: 200; payment: PaypalPaymentInfo; debt: DebtWithParties | null }
  | { httpStatus: 202; payment: PaypalPaymentInfo };

/** The parts of a PayPal capture object (Payments v2) settlement reads. */
export type PaypalCapture = {
  id: string;
  status?: string;
  amount?: { currency_code?: string; value?: string };
  payee?: { merchant_id?: string; email_address?: string };
  custom_id?: string;
};

export type CompletionOutcome =
  /** This call settled the payment (and the debt, when it was still pending). */
  | "completed"
  /** The payment was already COMPLETED or REFUNDED; nothing changed. */
  | "already_completed"
  /**
   * Payment completed, but the debt was deleted, already paid, or its amount changed after
   * checkout started: the debt was left alone and both people were emailed.
   */
  | "already_settled"
  /** Amount, currency or payee didn't match; payment marked FAILED, debt untouched. */
  | "failed";

/** A PayPal webhook event body (already signature-verified). */
export type PaypalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource_type?: string;
  resource?: Record<string, unknown>;
};

export class PaypalService {
  /**
   * Log in with PayPal authorize URL for the user (`GET /api/paypal/connect`).
   * `state` is HMAC-signed and carries `userId`, `platform` and, for iOS, the
   * app scheme picked from the allow-list by `appVariant` (X-App-Variant).
   * Throws PaypalConfigError when PayPal isn't configured.
   */
  buildConnectUrl(params: {
    userId: string;
    platform: PaypalPlatform;
    appVariant?: string | null;
  }): string {
    const { userId, platform, appVariant } = params;
    const { clientId } = getPaypalCredentials();
    const redirectUri = `${getAppUrl()}/api/paypal/callback`;
    const state = signState(
      platform === "ios"
        ? { userId, platform, scheme: schemeForVariant(appVariant) }
        : { userId, platform: "web" },
    );
    return (
      `${paypalWebBase()}/signin/authorize?flowEntry=static` +
      `&client_id=${encodeURIComponent(clientId)}&response_type=code` +
      `&scope=${encodeURIComponent(CONNECT_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`
    );
  }

  /**
   * `GET /api/paypal/callback`. Verifies state, exchanges the code, reads
   * userinfo and upserts the PaypalAccount. Never throws: always returns the
   * absolute URL to 302 to — web `{APP_URL}/profile?paypal=connected` or
   * `?paypal=error&reason=<code>`; iOS `{scheme}://paypal/connected?status=ok`
   * or `?status=error&reason=<code>`.
   * Reason codes: state | cancelled | in_use | no_payer_id | no_email | paypal | config | error.
   */
  async handleOAuthCallback(params: {
    code: string | null;
    state: string | null;
    error?: string | null;
  }): Promise<string> {
    const { code, state, error } = params;
    // Only decides where the browser goes, so an unverified state is fine here:
    // a scheme is used only if it's on the allow-list (no open redirect).
    const target = decodeStateUnverified(state);
    const redirect = (reason?: string) =>
      target?.platform === "ios" && isAppScheme(target.scheme)
        ? `${target.scheme}://paypal/connected?${reason ? `status=error&reason=${reason}` : "status=ok"}`
        : `${appUrlOrRelative()}/profile?${reason ? `paypal=error&reason=${reason}` : "paypal=connected"}`;

    try {
      const userId = verifyState(state)?.userId;
      if (typeof userId !== "string" || !userId) return redirect("state");
      if (error && error !== "access_denied") return redirect("paypal");
      if (error || !code) return redirect("cancelled");

      let info;
      try {
        // The user's access token is only used for this one call and never stored.
        info = await fetchUserInfo((await exchangeAuthorizationCode(code)).accessToken);
      } catch (e) {
        if (e instanceof PaypalConfigError) throw e;
        console.error("[PaypalService] Log in with PayPal failed:", e);
        return redirect("paypal");
      }

      const payerId = typeof info.payer_id === "string" ? info.payer_id : "";
      if (!payerId) return redirect("no_payer_id");
      const emails = (Array.isArray(info.emails) ? info.emails : []).filter(
        (entry) => typeof entry?.value === "string" && entry.value,
      );
      const primary = emails.find((entry) => isTrue(entry.primary)) ?? emails[0];
      const email = primary ? primary.value : info.email;
      const emailVerified = isTrue(primary ? primary.confirmed : info.email_verified);
      if (typeof email !== "string" || !email) return redirect("no_email");

      await prisma.paypalAccount.upsert({
        where: { userId },
        create: { userId, payerId, email, emailVerified },
        update: { payerId, email, emailVerified, connectedAt: new Date() },
      });
      return redirect();
    } catch (e) {
      if (e instanceof PaypalConfigError) return redirect("config");
      // Unique payerId: this PayPal account is already linked to another user.
      if ((e as { code?: unknown })?.code === "P2002") return redirect("in_use");
      console.error("[PaypalService] PayPal connect failed:", e);
      return redirect("error");
    }
  }

  /** The user's linked PayPal account, or null. */
  async getAccount(userId: string): Promise<PaypalAccountInfo | null> {
    return prisma.paypalAccount.findUnique({
      where: { userId },
      select: { email: true, emailVerified: true, connectedAt: true },
    });
  }

  /** Unlinks the user's PayPal account (idempotent). Existing payments keep their payeePayerId. */
  async disconnect(userId: string): Promise<void> {
    await prisma.paypalAccount.deleteMany({ where: { userId } });
  }

  /**
   * The `paypal` block for a debt the viewer may already see. DB reads only
   * (no PayPal API calls), so it is safe on every debt detail load.
   */
  async getDebtPaypalInfo(
    debt: PayableDebt,
    viewerId: string,
    hasPendingTransaction: boolean,
  ): Promise<DebtPaypalInfo> {
    const [lenderAccount, payments] = await Promise.all([
      prisma.paypalAccount.findUnique({ where: { userId: debt.lenderId }, select: { id: true } }),
      prisma.paypalPayment.findMany({
        where: { debtId: debt.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, amountCents: true, createdAt: true, completedAt: true },
      }),
    ]);
    return {
      lenderConnected: !!lenderAccount,
      // An APPROVED payment is a pending capture (money in flight): same rule as createDebtOrder.
      canPay:
        !!lenderAccount &&
        PaypalPolicy.canPayDebt(viewerId, debt, hasPendingTransaction) &&
        !payments.some((payment) => payment.status === "APPROVED"),
      payments: payments as PaypalPaymentInfo[],
    };
  }

  /**
   * `POST /api/debts/:id/paypal/order`. Amount, currency and payee always come
   * from the database. Throws PaypalFlowError:
   * 404 `Debt not found`;
   * 403 `Only the borrower can pay this debt with PayPal` |
   *     `This debt is already paid` | `This debt has a pending change request`;
   * 409 `The lender hasn't connected PayPal yet`;
   * 409 `A PayPal payment is already in progress for this debt` (a CREATED
   *     payment from the last 3 hours, or an APPROVED one of any age)
   *     (body `{ paymentId, approveUrl }`; approveUrl is null unless the
   *     in-progress payment is CREATED with an order id, i.e. resumable);
   * 409 `The lender's PayPal account can't receive payments right now`
   *     (PayPal rejected the payee, issue `PAYEE_*`);
   * 400 `This debt amount can't be paid with PayPal`;
   * 502 `PayPal couldn't start the payment. Try again.`.
   * Throws PaypalConfigError when PayPal isn't configured.
   */
  async createDebtOrder(params: {
    debtId: number;
    userId: string;
    platform: PaypalPlatform;
    appVariant?: string | null;
  }): Promise<{ paymentId: string; approveUrl: string }> {
    const { debtId, userId, platform, appVariant } = params;
    getPaypalCredentials();
    const appUrl = getAppUrl();

    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: {
        lender: { select: { paypalAccount: { select: { payerId: true } } } },
        transactions: { where: { status: "pending" }, select: { id: true } },
      },
    });
    if (!debt) throw new PaypalFlowError(404, "Debt not found");
    if (debt.borrowerId !== userId) {
      throw new PaypalFlowError(403, "Only the borrower can pay this debt with PayPal");
    }
    if (debt.status !== "pending") throw new PaypalFlowError(403, "This debt is already paid");
    if (debt.transactions.length > 0) {
      throw new PaypalFlowError(403, "This debt has a pending change request");
    }
    const payeePayerId = debt.lender.paypalAccount?.payerId;
    if (!payeePayerId) throw new PaypalFlowError(409, "The lender hasn't connected PayPal yet");

    const amountCents = Math.round(debt.amount * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1) {
      throw new PaypalFlowError(400, "This debt amount can't be paid with PayPal");
    }

    // The debt row lock makes the in-progress check and the insert atomic per debt, so two
    // concurrent requests can't both start an order. PayPal is called after the commit.
    const payment = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<unknown[]>`SELECT 1 FROM "Debt" WHERE id = ${debtId} FOR UPDATE`;
      if (locked.length === 0) throw new PaypalFlowError(404, "Debt not found");

      const inProgress = await tx.paypalPayment.findFirst({
        where: {
          debtId,
          OR: [
            {
              status: "CREATED",
              orderId: { not: null },
              createdAt: { gt: new Date(Date.now() - ORDER_RESUMABLE_MS) },
            },
            // No order id yet: creating it is still running, or the function died before saving
            // it (maxDuration can be shorter than our 30 s PayPal timeout). Nobody can pay it.
            {
              status: "CREATED",
              orderId: null,
              createdAt: { gt: new Date(Date.now() - ORDER_CREATION_MS) },
            },
            // APPROVED = PayPal returned a PENDING capture (e.g. an eCheck can take days): money
            // is in flight, so it blocks at any age. ponytail: if that capture never resolves
            // (missed webhooks), PayPal stays blocked for this debt; the borrower can still
            // "Mark as paid", and an admin can mark the payment FAILED to unblock it.
            { status: "APPROVED" },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, orderId: true },
      });
      if (inProgress) {
        throw new PaypalFlowError(409, "A PayPal payment is already in progress for this debt", {
          paymentId: inProgress.id,
          approveUrl:
            inProgress.status === "CREATED" && inProgress.orderId
              ? checkoutUrl(inProgress.orderId)
              : null,
        });
      }

      // The row exists before the order: its id is the order's PayPal-Request-Id and custom_id.
      return tx.paypalPayment.create({
        data: {
          debtId,
          payerUserId: userId,
          payeeUserId: debt.lenderId,
          payeePayerId,
          amountCents,
          currency: "USD",
          platform,
          returnScheme: platform === "ios" ? schemeForVariant(appVariant) : null,
        },
      });
    });

    // PayPal allows 127 characters (counted in UTF-16 units): clip the user's text by whole
    // code points so the "(debt #id)" suffix stays and no surrogate pair is split.
    const prefix = "Broke Besties: ";
    const suffix = ` (debt #${debtId})`;
    let text = "";
    for (const char of debt.description?.trim() ?? "") {
      if (prefix.length + text.length + char.length + suffix.length > 127) break;
      text += char;
    }
    const returnUrl = `${appUrl}/paypal/return?pp=${encodeURIComponent(payment.id)}&platform=${platform}`;
    try {
      const order = await paypalFetch<PaypalOrder | null>("/v2/checkout/orders", {
        method: "POST",
        requestId: payment.id,
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: `debt-${debtId}`,
              custom_id: payment.id,
              description: text ? `${prefix}${text}${suffix}` : `${prefix}debt #${debtId}`,
              amount: { currency_code: "USD", value: centsToAmount(amountCents) },
              payee: { merchant_id: payeePayerId },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "Broke Besties",
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                return_url: returnUrl,
                cancel_url: `${returnUrl}&cancelled=1`,
              },
            },
          },
        }),
      });
      const links = order?.links ?? [];
      const approveUrl = (
        links.find((link) => link.rel === "payer-action") ?? links.find((link) => link.rel === "approve")
      )?.href;
      if (!order?.id || !approveUrl) throw new Error("PayPal order has no id or approve link");

      await prisma.paypalPayment.update({ where: { id: payment.id }, data: { orderId: order.id } });
      return { paymentId: payment.id, approveUrl };
    } catch (error) {
      console.error("[PaypalService] Creating a PayPal order failed:", { paymentId: payment.id, error });
      await this.markFailed(payment.id, `Order creation failed: ${describeError(error)}`);
      if (error instanceof PaypalError && error.details.some((d) => d.issue?.startsWith("PAYEE_"))) {
        throw new PaypalFlowError(409, "The lender's PayPal account can't receive payments right now");
      }
      throw new PaypalFlowError(502, "PayPal couldn't start the payment. Try again.");
    }
  }

  /**
   * `POST /api/paypal/payments/:id/capture` (idempotent). Throws PaypalFlowError:
   * 404 `Payment not found`; 403 `Only the payer can capture this payment`;
   * 409 `Payment wasn't approved in PayPal`; 409 `This PayPal payment was refunded`;
   * 409 `This PayPal payment failed. Start a new payment.`;
   * 409 `This debt is already settled` | `This debt's amount changed. Start a new PayPal payment.` |
   *     `The lender's PayPal account changed. Start a new PayPal payment.` (checked in that order
   *     before capturing; PayPal is asked first, and unless an earlier attempt already captured,
   *     the payment becomes CANCELLED and nothing is charged);
   * 402 `PayPal declined the payment method. Try again with a different one.`;
   * 502 `PayPal couldn't complete the payment`;
   * 502 `PayPal payment couldn't be verified` (capture didn't match the debt).
   * Already COMPLETED → 200 with the current payment and debt (idempotent).
   * Throws PaypalConfigError when PayPal isn't configured.
   */
  async capturePayment(paymentId: string, userId: string): Promise<CaptureResult> {
    getPaypalCredentials();
    const payment = await prisma.paypalPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new PaypalFlowError(404, "Payment not found");
    if (payment.payerUserId !== userId) {
      throw new PaypalFlowError(403, "Only the payer can capture this payment");
    }
    return this.capture(payment);
  }

  /** capturePayment without the payer check; also run for CHECKOUT.ORDER.APPROVED webhooks. */
  private async capture(payment: {
    id: string;
    status: string;
    orderId: string | null;
    debtId: number | null;
    amountCents: number;
    payeePayerId: string;
    updatedAt: Date;
  }) {
    // Already settled: captureResult answers 200 (COMPLETED) or the refunded/failed 409.
    if (["COMPLETED", "REFUNDED", "FAILED"].includes(payment.status)) return this.captureResult(payment.id);
    if (!payment.orderId) throw new PaypalFlowError(409, "Payment wasn't approved in PayPal");

    const orderPath = `/v2/checkout/orders/${encodeURIComponent(payment.orderId)}`;
    const failed = new PaypalFlowError(502, "PayPal couldn't complete the payment");
    // The order as PayPal has it; a failed read leaves the row alone (outcome unknown).
    const readOrder = () =>
      paypalFetch<PaypalOrder | null>(orderPath).catch(() => {
        throw failed;
      });

    let refusal: { reason: string; message: string } | null = null;
    if (payment.status === "CREATED" || payment.status === "CANCELLED") {
      // Before capturing: don't take money for a debt that was settled or changed since the
      // order, or pay a PayPal account the lender has since replaced. CANCELLED doesn't block a
      // new order, so the borrower can start over.
      const debt = payment.debtId
        ? await prisma.debt.findUnique({
            where: { id: payment.debtId },
            select: {
              status: true,
              amount: true,
              lender: { select: { paypalAccount: { select: { payerId: true } } } },
            },
          })
        : null;
      if (!debt || debt.status !== "pending") {
        refusal = { reason: "Debt settled before capture", message: "This debt is already settled" };
      } else if (Math.round(debt.amount * 100) !== payment.amountCents) {
        refusal = {
          reason: "Debt amount changed before capture",
          message: "This debt's amount changed. Start a new PayPal payment.",
        };
      } else if (debt.lender.paypalAccount?.payerId !== payment.payeePayerId) {
        refusal = {
          reason: "Lender's PayPal account changed before capture",
          message: "The lender's PayPal account changed. Start a new PayPal payment.",
        };
      }
    }

    let order: PaypalOrder | null;
    if (refusal) {
      // An earlier capture whose answer was lost may already have taken the money: ask PayPal.
      order = await readOrder();
      if (!order?.purchase_units?.[0]?.payments?.captures?.[0]?.id) {
        const cancelled = await prisma.paypalPayment.updateMany({
          where: { id: payment.id, status: { in: ["CREATED", "CANCELLED"] } },
          data: { status: "CANCELLED", failureReason: refusal.reason },
        });
        // No row: a racing capture or webhook moved the payment on; answer with what it did.
        if (cancelled.count === 0) return this.captureResult(payment.id);
        throw new PaypalFlowError(409, refusal.message);
      }
    } else {
      try {
        order = await paypalFetch<PaypalOrder | null>(`${orderPath}/capture`, {
          method: "POST",
          body: "{}",
          headers: { Prefer: "return=representation" },
          // PayPal replays its stored answer (even a 422) for a repeated PayPal-Request-Id, so the
          // key follows the row: an unknown outcome leaves the row alone and the retry replays the
          // original result (no double capture); a retryable decline touches the row so the next
          // attempt is a fresh capture.
          requestId: `capture-${payment.id}-${payment.updatedAt.getTime()}`,
        });
      } catch (error) {
        console.error("[PaypalService] PayPal capture failed:", { paymentId: payment.id, error });
        if (error instanceof PaypalError && hasIssue(error, "ORDER_ALREADY_CAPTURED")) {
          order = await readOrder();
        } else if (
          error instanceof PaypalError &&
          (hasIssue(error, "INSTRUMENT_DECLINED") || hasIssue(error, "ORDER_NOT_APPROVED"))
        ) {
          const declined = hasIssue(error, "INSTRUMENT_DECLINED");
          await prisma.paypalPayment.updateMany({
            where: { id: payment.id, status: { in: ["CREATED", "CANCELLED"] } },
            data: { failureReason: declined ? "INSTRUMENT_DECLINED" : "ORDER_NOT_APPROVED" },
          });
          throw declined
            ? new PaypalFlowError(402, "PayPal declined the payment method. Try again with a different one.")
            : new PaypalFlowError(409, "Payment wasn't approved in PayPal");
        } else if (captureOutcomeUnknown(error)) {
          throw failed;
        } else {
          await this.markFailed(payment.id, `Capture failed: ${describeError(error)}`);
          throw failed;
        }
      }
    }

    const unit = order?.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    if (!capture?.id) throw failed; // no capture to read: outcome unknown, leave the row alone

    if (capture.status === "COMPLETED") {
      const outcome = await this.completeFromCapture(
        payment.id,
        capture.payee?.merchant_id ? capture : { ...capture, payee: unit?.payee },
      );
      if (outcome === "failed") throw new PaypalFlowError(502, "PayPal payment couldn't be verified");
    } else if (capture.status === "PENDING") {
      // e.g. an eCheck: the PAYMENT.CAPTURE.* webhook finishes it.
      await prisma.paypalPayment.updateMany({
        where: { id: payment.id, status: { in: ["CREATED", "CANCELLED"] } },
        data: { status: "APPROVED", captureId: capture.id, failureReason: null },
      });
    } else {
      await this.markFailed(payment.id, `Capture ${capture.id} is ${capture.status}`);
      throw failed;
    }
    return this.captureResult(payment.id);
  }

  private async captureResult(paymentId: string): Promise<CaptureResult> {
    const payment = await prisma.paypalPayment.findUnique({
      where: { id: paymentId },
      include: { debt: { include: debtWithPartiesInclude } },
    });
    if (!payment) throw new PaypalFlowError(404, "Payment not found");
    const info: PaypalPaymentInfo = {
      id: payment.id,
      status: payment.status as PaypalPaymentStatus,
      amountCents: payment.amountCents,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
    };
    if (payment.status === "COMPLETED") return { httpStatus: 200, payment: info, debt: payment.debt };
    if (payment.status === "REFUNDED") throw new PaypalFlowError(409, "This PayPal payment was refunded");
    if (payment.status === "FAILED") {
      throw new PaypalFlowError(409, "This PayPal payment failed. Start a new payment.");
    }
    return { httpStatus: 202, payment: info };
  }

  /** Settlement rules (spec P.8). Idempotent; safe for capture + webhook racing. */
  async completeFromCapture(
    paymentId: string,
    capture: PaypalCapture,
  ): Promise<CompletionOutcome> {
    if (capture.status !== "COMPLETED" || !capture.id) {
      throw new Error(`Can't settle PayPal capture ${capture.id} with status ${capture.status}`);
    }
    const payment = await prisma.paypalPayment.findUnique({
      where: { id: paymentId },
      include: paymentWithPartiesInclude,
    });
    if (!payment) throw new Error(`PayPal payment ${paymentId} not found`);
    if (payment.status === "COMPLETED" || payment.status === "REFUNDED") return "already_completed";

    let payee = capture.payee?.merchant_id;
    if (!payee && payment.orderId) {
      const order = await paypalFetch<PaypalOrder | null>(
        `/v2/checkout/orders/${encodeURIComponent(payment.orderId)}`,
      );
      payee = order?.purchase_units?.[0]?.payee?.merchant_id;
    }
    const mismatch = [
      amountToCents(capture.amount?.value) !== payment.amountCents && `amount ${capture.amount?.value}`,
      capture.amount?.currency_code !== "USD" && `currency ${capture.amount?.currency_code}`,
      payee !== payment.payeePayerId && `payee ${payee ?? "missing"}`,
    ].filter(Boolean);
    if (mismatch.length > 0) {
      const reason = `Capture ${capture.id} doesn't match the payment: ${mismatch.join(", ")}`;
      console.error(`[PaypalService] ${reason}; debt left unchanged`, { paymentId });
      // Same guard as markFailed; the capture id lets a later refund/reversal still find it.
      await prisma.paypalPayment.updateMany({
        where: { id: payment.id, status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
        data: { status: "FAILED", failureReason: reason, captureId: capture.id },
      });
      return "failed";
    }

    const debtId = payment.debtId;
    const now = new Date();
    const outcome = await prisma.$transaction(async (tx) => {
      // The guarded update claims the payment: when capture and webhook race, one of them wins.
      const claimed = await tx.paypalPayment.updateMany({
        where: { id: payment.id, status: { notIn: ["COMPLETED", "REFUNDED"] } },
        data: { status: "COMPLETED", captureId: capture.id, completedAt: now, failureReason: null },
      });
      if (claimed.count === 0) return "already_completed" as const;
      if (debtId === null) return "already_settled" as const;

      // Settle only the debt this money was for: still pending, still the paid amount.
      const debt = await tx.debt.findUnique({
        where: { id: debtId },
        select: { status: true, amount: true, alertId: true },
      });
      if (!debt || debt.status !== "pending" || Math.round(debt.amount * 100) !== payment.amountCents) {
        return "already_settled" as const;
      }
      const settled = await tx.debt.updateMany({
        where: { id: debtId, status: "pending", amount: debt.amount },
        data: { status: "paid" },
      });
      if (settled.count === 0) return "already_settled" as const;

      // Same effects as an approved confirm_paid, plus its audit record for the Activity list.
      if (debt.alertId) {
        await tx.alert.updateMany({ where: { id: debt.alertId }, data: { isActive: false } });
      }
      await tx.debtTransaction.updateMany({
        where: { debtId, status: "pending" },
        data: { status: "cancelled", resolvedAt: now },
      });
      await tx.debtTransaction.create({
        data: {
          debtId,
          type: "confirm_paid",
          status: "approved",
          requesterId: payment.payerUserId,
          lenderApproved: true,
          borrowerApproved: true,
          reason: `Paid with PayPal (capture ${capture.id})`,
          resolvedAt: now,
        },
      });
      return "completed" as const;
    });

    if (outcome !== "already_completed") {
      const alreadySettled = outcome === "already_settled";
      const recipients = alreadySettled ? [payment.payee, payment.payer] : [payment.payee];
      // After commit; emailService never throws (a failed send resolves { success: false }).
      await Promise.all(
        recipients.map((person) =>
          emailService.sendPaypalPaymentReceived({
            to: person.email,
            recipientName: person.name || person.email,
            ...paymentEmail(payment),
            alreadySettled,
          }),
        ),
      );
    }
    return outcome;
  }

  /** Marks a not-yet-completed payment FAILED with a reason. */
  async markFailed(paymentId: string, reason: string): Promise<void> {
    // Never COMPLETED/REFUNDED: a late error from a racing capture must not undo a settlement.
    await prisma.paypalPayment.updateMany({
      where: { id: paymentId, status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
      data: { status: "FAILED", failureReason: reason },
    });
  }

  /**
   * Refund/reversal path (spec P.8 `markRefunded`). Idempotent.
   * ponytail: a partial refund counts as a full one (payment REFUNDED, debt reopened). Compare
   * the refunded amount with amountCents if partial refunds ever matter.
   */
  async markRefunded(paymentId: string): Promise<void> {
    const payment = await prisma.paypalPayment.findUnique({
      where: { id: paymentId },
      include: paymentWithPartiesInclude,
    });
    if (!payment || payment.status === "REFUNDED") return;

    const debtReopened = await prisma.$transaction(async (tx) => {
      const claimed = await tx.paypalPayment.updateMany({
        where: { id: payment.id, status: { not: "REFUNDED" } },
        data: { status: "REFUNDED" },
      });
      if (claimed.count === 0) return null;
      // Re-read under the row lock: a racing completion may have committed since the read above.
      const current = await tx.paypalPayment.findUnique({
        where: { id: payment.id },
        select: { debtId: true, captureId: true },
      });
      const debtId = current?.debtId;
      const captureId = current?.captureId;
      if (!debtId || !captureId) return false;

      // Reopen only if this capture is what marked the debt paid.
      const latestPaid = await tx.debtTransaction.findFirst({
        where: { debtId, type: "confirm_paid", status: "approved" },
        orderBy: [{ resolvedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        select: { reason: true },
      });
      if (!latestPaid?.reason?.includes(`(capture ${captureId})`)) return false;

      const reopened = await tx.debt.updateMany({
        where: { id: debtId, status: "paid" },
        data: { status: "pending" },
      });
      if (reopened.count === 0) return false;
      await tx.debtTransaction.create({
        data: {
          debtId,
          type: "confirm_paid",
          status: "cancelled",
          requesterId: payment.payeeUserId,
          reason: "PayPal payment refunded",
          resolvedAt: new Date(),
        },
      });
      return true;
    });

    if (debtReopened === null) return;
    await Promise.all(
      [payment.payee, payment.payer].map((person) =>
        emailService.sendPaypalPaymentRefunded({
          to: person.email,
          recipientName: person.name || person.email,
          ...paymentEmail(payment),
          debtReopened,
        }),
      ),
    );
  }

  /**
   * `GET /paypal/return` bridge: absolute URL to 302 to. Marks the payment
   * CANCELLED when `cancelled` and it is still CREATED. Never throws.
   * iOS → `{returnScheme}://paypal/return?pp=…&status=approved|cancelled`;
   * web → `{APP_URL}/debts/{debtId}?paypal=approved|cancelled&pp=…`.
   */
  async getReturnRedirect(params: {
    paymentId: string | null;
    orderToken: string | null;
    cancelled: boolean;
  }): Promise<string> {
    const { paymentId, orderToken, cancelled } = params;
    const appUrl = appUrlOrRelative();
    const status = cancelled ? "cancelled" : "approved";
    try {
      const payment = paymentId
        ? await prisma.paypalPayment.findUnique({ where: { id: paymentId } })
        : null;
      if (!payment) return `${appUrl}/debts?paypal=error`;

      // PayPal sends the order id as `token`; requiring it means a guessed link can't cancel.
      if (cancelled && orderToken && orderToken === payment.orderId) {
        await prisma.paypalPayment.updateMany({
          where: { id: payment.id, status: "CREATED" },
          data: { status: "CANCELLED" },
        });
      }

      const pp = encodeURIComponent(payment.id);
      if (payment.platform === "ios") {
        const scheme = isAppScheme(payment.returnScheme) ? payment.returnScheme : "brokebesties";
        return `${scheme}://paypal/return?pp=${pp}&status=${status}`;
      }
      const debtPath = payment.debtId ? `/debts/${payment.debtId}` : "/debts";
      return `${appUrl}${debtPath}?paypal=${status}&pp=${pp}`;
    } catch (error) {
      console.error("[PaypalService] PayPal return redirect failed:", error);
      return `${appUrl}/debts?paypal=error`;
    }
  }

  /**
   * Verifies a webhook with PayPal's verify-webhook-signature API. Returns
   * false when signature headers are missing or PayPal doesn't answer SUCCESS.
   * Throws PaypalConfigError when PAYPAL_WEBHOOK_ID or credentials are missing,
   * and rethrows network/PayPal errors (the route answers 500 so PayPal retries).
   */
  async verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
    const webhookId = getWebhookId();
    getPaypalCredentials();

    const fields: Record<string, string | null> = {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
    };
    if (Object.values(fields).some((value) => !value)) return false;

    // The raw body is embedded verbatim (re-serializing the parsed event can break PayPal's
    // check), so it must be exactly one JSON object or it could inject fields like webhook_id.
    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return false;
    }
    if (!event || typeof event !== "object" || Array.isArray(event)) return false;

    const head = JSON.stringify({ ...fields, webhook_id: webhookId }).slice(0, -1);
    const result = await paypalFetch<{ verification_status?: string } | null>(
      "/v1/notifications/verify-webhook-signature",
      { method: "POST", body: `${head},"webhook_event":${rawBody}}` },
    );
    return result?.verification_status === "SUCCESS";
  }

  /**
   * Dispatches a verified webhook event (spec P.7). Returns handled=false for
   * events about orders that aren't ours or event types we ignore.
   */
  async handleWebhook(event: PaypalWebhookEvent): Promise<{ handled: boolean }> {
    const type = event.event_type ?? "";
    if (!WEBHOOK_EVENTS.includes(type)) return { handled: false };
    const resource = (event.resource ?? {}) as WebhookResource;

    // Refund resources don't always carry custom_id/order_id, so also match by capture id.
    const related = resource.supplementary_data?.related_ids;
    const upHref = resource.links?.find((link) => link.rel === "up")?.href ?? "";
    const lookups: ["id" | "orderId" | "captureId", unknown][] = [
      ["id", resource.custom_id],
      ["id", resource.purchase_units?.[0]?.custom_id],
      ["orderId", type.startsWith("CHECKOUT.ORDER.") ? resource.id : undefined],
      ["orderId", related?.order_id],
      ["captureId", event.resource_type === "capture" ? resource.id : undefined],
      ["captureId", related?.capture_id],
      ["captureId", /\/v2\/payments\/captures\/([^/?#]+)/.exec(upHref)?.[1]],
    ];
    let payment = null;
    for (const [field, value] of lookups) {
      if (typeof value !== "string" || !value) continue;
      payment = await prisma.paypalPayment.findUnique({
        where:
          field === "id" ? { id: value } : field === "orderId" ? { orderId: value } : { captureId: value },
      });
      if (payment) break;
    }
    if (!payment) return { handled: false };

    if (type === "CHECKOUT.ORDER.APPROVED") {
      // The client may never come back (app killed), so capture here too.
      try {
        await this.capture(payment);
      } catch (error) {
        if (!(error instanceof PaypalFlowError)) throw error;
        if (error.status === 502) {
          // Row untouched means the outcome is unknown: fail the delivery so PayPal sends the
          // event again, and the retry reuses the same PayPal-Request-Id.
          const current = await prisma.paypalPayment.findUnique({
            where: { id: payment.id },
            select: { status: true },
          });
          if (["CREATED", "APPROVED", "CANCELLED"].includes(current?.status ?? "")) throw error;
        }
        console.error("[PaypalService] Webhook capture failed:", { paymentId: payment.id, error: error.message });
      }
    } else if (type === "PAYMENT.CAPTURE.COMPLETED") {
      await this.completeFromCapture(payment.id, resource);
    } else if (type === "PAYMENT.CAPTURE.PENDING") {
      await prisma.paypalPayment.updateMany({
        where: { id: payment.id, status: { in: ["CREATED", "CANCELLED"] } },
        data: { status: "APPROVED", captureId: resource.id, failureReason: null },
      });
    } else if (type === "PAYMENT.CAPTURE.DENIED") {
      await this.markFailed(payment.id, `PayPal denied capture ${resource.id}`);
    } else {
      await this.markRefunded(payment.id);
    }
    return { handled: true };
  }
}

export const paypalService = new PaypalService();
