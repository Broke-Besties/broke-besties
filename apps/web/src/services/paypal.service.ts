// CONTRACT STUB (Phase 0). The PayPal-core work replaces every method body;
// signatures, exported types and documented behavior are the contract the
// routes and web UI code against. See specs/backend.md Part B and
// docs/superpowers/plans/2026-10-03-backend-and-paypal.md.
import type { Prisma } from "@prisma/client";

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
  /** Viewer is the borrower, canPayDebt(...) holds, and the lender connected PayPal. */
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
  /** Payment completed, but the debt was deleted or already paid; both people were emailed. */
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
    void params;
    throw new Error("Not implemented");
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
    void params;
    throw new Error("Not implemented");
  }

  /** The user's linked PayPal account, or null. */
  async getAccount(userId: string): Promise<PaypalAccountInfo | null> {
    void userId;
    throw new Error("Not implemented");
  }

  /** Unlinks the user's PayPal account (idempotent). Existing payments keep their payeePayerId. */
  async disconnect(userId: string): Promise<void> {
    void userId;
    throw new Error("Not implemented");
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
    void debt;
    void viewerId;
    void hasPendingTransaction;
    throw new Error("Not implemented");
  }

  /**
   * `POST /api/debts/:id/paypal/order`. Amount, currency and payee always come
   * from the database. Throws PaypalFlowError:
   * 404 `Debt not found`;
   * 403 `Only the borrower can pay this debt with PayPal` |
   *     `This debt is already paid` | `This debt has a pending change request`;
   * 409 `The lender hasn't connected PayPal yet`;
   * 409 `A PayPal payment is already in progress for this debt`
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
    void params;
    throw new Error("Not implemented");
  }

  /**
   * `POST /api/paypal/payments/:id/capture` (idempotent). Throws PaypalFlowError:
   * 404 `Payment not found`; 403 `Only the payer can capture this payment`;
   * 409 `Payment wasn't approved in PayPal`; 409 `This PayPal payment was refunded`;
   * 409 `This PayPal payment failed. Start a new payment.`;
   * 402 `PayPal declined the payment method. Try again with a different one.`;
   * 502 `PayPal couldn't complete the payment`;
   * 502 `PayPal payment couldn't be verified` (capture didn't match the debt).
   * Already COMPLETED → 200 with the current payment and debt (idempotent).
   * Throws PaypalConfigError when PayPal isn't configured.
   */
  async capturePayment(paymentId: string, userId: string): Promise<CaptureResult> {
    void paymentId;
    void userId;
    throw new Error("Not implemented");
  }

  /** Settlement rules (spec P.8). Idempotent; safe for capture + webhook racing. */
  async completeFromCapture(
    paymentId: string,
    capture: PaypalCapture,
  ): Promise<CompletionOutcome> {
    void paymentId;
    void capture;
    throw new Error("Not implemented");
  }

  /** Marks a not-yet-completed payment FAILED with a reason. */
  async markFailed(paymentId: string, reason: string): Promise<void> {
    void paymentId;
    void reason;
    throw new Error("Not implemented");
  }

  /** Refund/reversal path (spec P.8 `markRefunded`). Idempotent. */
  async markRefunded(paymentId: string): Promise<void> {
    void paymentId;
    throw new Error("Not implemented");
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
    void params;
    throw new Error("Not implemented");
  }

  /**
   * Verifies a webhook with PayPal's verify-webhook-signature API. Returns
   * false when signature headers are missing or PayPal doesn't answer SUCCESS.
   * Throws PaypalConfigError when PAYPAL_WEBHOOK_ID or credentials are missing,
   * and rethrows network/PayPal errors (the route answers 500 so PayPal retries).
   */
  async verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
    void headers;
    void rawBody;
    throw new Error("Not implemented");
  }

  /**
   * Dispatches a verified webhook event (spec P.7). Returns handled=false for
   * events about orders that aren't ours or event types we ignore.
   */
  async handleWebhook(event: PaypalWebhookEvent): Promise<{ handled: boolean }> {
    void event;
    throw new Error("Not implemented");
  }
}

export const paypalService = new PaypalService();
