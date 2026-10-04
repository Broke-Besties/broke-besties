export type PaypalReturn =
  | { status: "approved"; paymentId: string }
  | { status: "cancelled" };

export function parsePaypalReturn(
  paypal: string | undefined,
  pp: string | undefined,
): PaypalReturn | null {
  if (paypal === "cancelled") return { status: "cancelled" };
  // pp is interpolated into a fetch path, so a crafted link must not be able
  // to point the capture POST at another route.
  if (paypal === "approved" && pp && /^[\w-]+$/.test(pp)) {
    return { status: "approved", paymentId: pp };
  }
  return null;
}

// The reason text is user-writable on change requests, so only approved
// confirmations (the settlement's own audit row) count.
export const isPaypalTransaction = (t: { type: string; status: string; reason: string | null }) =>
  t.type === "confirm_paid" && t.status === "approved" && !!t.reason?.startsWith("Paid with PayPal");

/** The JSON body of POST /api/paypal/payments/:id/capture ({} when there is none). */
type CaptureBody = {
  payment?: { amountCents: number };
  debt?: { status: string } | null;
  error?: string;
};

/**
 * The toast after capturing on the return from PayPal. A 200 can carry a debt that wasn't
 * marked paid (settled, changed or deleted meanwhile): only a paid debt is a success.
 */
export function paypalCaptureToast(
  status: number,
  body: CaptureBody,
  lenderName: string,
): { tone: "success" | "neutral" | "error"; message: string } {
  if (status === 202) return { tone: "neutral", message: "PayPal is processing your payment" };
  if (status < 200 || status > 299) {
    return { tone: "error", message: body.error || "Couldn't confirm your PayPal payment" };
  }
  if (body.payment && body.debt?.status === "paid") {
    const amount = `$${(body.payment.amountCents / 100).toFixed(2)}`;
    return { tone: "success", message: `Paid ${lenderName} ${amount} with PayPal` };
  }
  return {
    tone: "neutral",
    message: "PayPal payment received, but the debt wasn't marked paid. Check your email.",
  };
}
