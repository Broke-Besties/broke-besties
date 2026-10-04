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

export const isPaypalTransaction = (t: { type: string; reason: string | null }) =>
  t.type === "confirm_paid" && !!t.reason?.startsWith("Paid with PayPal");

// Payments come newest first.
export const isPaypalProcessing = (payments: { status: string }[]) =>
  payments[0]?.status === "APPROVED";
