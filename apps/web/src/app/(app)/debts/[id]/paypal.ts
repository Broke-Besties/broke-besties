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
