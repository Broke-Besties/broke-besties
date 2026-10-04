import { describe, expect, it } from "vitest";
import { PaypalPolicy } from "@/policies/paypal.policy";

describe("PaypalPolicy.canPayDebt", () => {
  const debt = { borrowerId: "u2", status: "pending" };

  it("allows the borrower of a pending debt with no pending change request", () => {
    expect(PaypalPolicy.canPayDebt("u2", debt, false)).toBe(true);
  });

  it("rejects anyone but the borrower", () => {
    expect(PaypalPolicy.canPayDebt("u1", debt, false)).toBe(false);
    expect(PaypalPolicy.canPayDebt("", debt, false)).toBe(false);
  });

  it("rejects a debt that isn't pending", () => {
    expect(PaypalPolicy.canPayDebt("u2", { ...debt, status: "paid" }, false)).toBe(false);
  });

  it("rejects a debt with a pending change request", () => {
    expect(PaypalPolicy.canPayDebt("u2", debt, true)).toBe(false);
  });
});
