import { describe, expect, it } from "vitest";
import {
  isPaypalProcessing,
  isPaypalTransaction,
  parsePaypalReturn,
} from "./paypal";

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
  it("is a confirm_paid whose reason starts with Paid with PayPal", () => {
    expect(
      isPaypalTransaction({
        type: "confirm_paid",
        reason: "Paid with PayPal (capture 1AB23456CD789012E)",
      }),
    ).toBe(true);
  });

  it("rejects other types and reasons", () => {
    expect(isPaypalTransaction({ type: "modify", reason: "Paid with PayPal" })).toBe(false);
    expect(isPaypalTransaction({ type: "confirm_paid", reason: "PayPal payment refunded" })).toBe(false);
    expect(isPaypalTransaction({ type: "confirm_paid", reason: null })).toBe(false);
  });
});

describe("isPaypalProcessing", () => {
  it("looks only at the newest payment (payments come newest first)", () => {
    expect(isPaypalProcessing([{ status: "APPROVED" }, { status: "FAILED" }])).toBe(true);
    expect(isPaypalProcessing([{ status: "COMPLETED" }, { status: "APPROVED" }])).toBe(false);
    expect(isPaypalProcessing([])).toBe(false);
  });
});
