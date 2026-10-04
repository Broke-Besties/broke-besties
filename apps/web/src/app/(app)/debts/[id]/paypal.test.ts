import { describe, expect, it } from "vitest";
import { isPaypalTransaction, parsePaypalReturn, paypalCaptureToast } from "./paypal";

describe("parsePaypalReturn", () => {
  it("reads an approved return with its payment id", () => {
    expect(parsePaypalReturn("approved", "cm1abc_9-Z")).toEqual({
      status: "approved",
      paymentId: "cm1abc_9-Z",
    });
  });

  it("reads a cancelled return, with or without pp", () => {
    expect(parsePaypalReturn("cancelled", "cm1abc")).toEqual({ status: "cancelled" });
    expect(parsePaypalReturn("cancelled", undefined)).toEqual({ status: "cancelled" });
  });

  it("ignores approved without a usable payment id", () => {
    expect(parsePaypalReturn("approved", undefined)).toBeNull();
    expect(parsePaypalReturn("approved", "")).toBeNull();
    // pp is interpolated into a fetch path: no traversal into other routes
    expect(parsePaypalReturn("approved", "../../friends/1/accept")).toBeNull();
    expect(parsePaypalReturn("approved", "..")).toBeNull();
    expect(parsePaypalReturn("approved", "a?b")).toBeNull();
  });

  it("ignores anything else", () => {
    expect(parsePaypalReturn(undefined, "cm1abc")).toBeNull();
    expect(parsePaypalReturn("connected", "cm1abc")).toBeNull();
  });
});

describe("isPaypalTransaction", () => {
  it("is an approved confirm_paid whose reason starts with Paid with PayPal", () => {
    expect(
      isPaypalTransaction({
        type: "confirm_paid",
        status: "approved",
        reason: "Paid with PayPal (capture 1AB23456CD789012E)",
      }),
    ).toBe(true);
  });

  it("rejects other types, reasons, and unapproved requests (reason is user-writable)", () => {
    const paid = "Paid with PayPal";
    expect(isPaypalTransaction({ type: "modify", status: "approved", reason: paid })).toBe(false);
    expect(isPaypalTransaction({ type: "confirm_paid", status: "pending", reason: paid })).toBe(false);
    expect(isPaypalTransaction({ type: "confirm_paid", status: "cancelled", reason: "PayPal payment refunded" })).toBe(false);
    expect(isPaypalTransaction({ type: "confirm_paid", status: "approved", reason: null })).toBe(false);
  });
});

describe("paypalCaptureToast", () => {
  const notMarkedPaid = {
    tone: "neutral",
    message: "PayPal payment received, but the debt wasn't marked paid. Check your email.",
  };

  it("reports success only when the capture marked the debt paid, with the amount PayPal took", () => {
    const paid = { payment: { amountCents: 4250 }, debt: { status: "paid" } };
    expect(paypalCaptureToast(200, paid, "Larry")).toEqual({
      tone: "success",
      message: "Paid Larry $42.50 with PayPal",
    });
  });

  it("says the debt wasn't marked paid when it was settled, changed or deleted meanwhile", () => {
    for (const debt of [{ status: "pending" }, null]) {
      const body = { payment: { amountCents: 4250 }, debt };
      expect(paypalCaptureToast(200, body, "Larry")).toEqual(notMarkedPaid);
    }
  });

  it("says PayPal is still processing a pending capture", () => {
    expect(paypalCaptureToast(202, { payment: { amountCents: 4250 } }, "Larry")).toEqual({
      tone: "neutral",
      message: "PayPal is processing your payment",
    });
  });

  it("shows the server's error, or a generic one", () => {
    const amountChanged = "This debt's amount changed. Start a new PayPal payment.";
    expect(paypalCaptureToast(409, { error: amountChanged }, "Larry")).toEqual({
      tone: "error",
      message: amountChanged,
    });
    expect(paypalCaptureToast(500, {}, "Larry")).toEqual({
      tone: "error",
      message: "Couldn't confirm your PayPal payment",
    });
  });
});
