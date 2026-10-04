import { describe, expect, it } from "vitest";
import { paypalConnectError } from "./paypal-messages";

describe("paypalConnectError", () => {
  it("maps the known callback reasons", () => {
    expect(paypalConnectError("in_use")).toBe(
      "That PayPal account is already linked to another Broke Besties account",
    );
    expect(paypalConnectError("state")).toBe("The PayPal connection expired. Try again.");
    expect(paypalConnectError("cancelled")).toBe("PayPal connection cancelled");
  });

  it("falls back for unknown or missing reasons", () => {
    expect(paypalConnectError("no_email")).toBe("Couldn't connect PayPal. Try again.");
    expect(paypalConnectError("constructor")).toBe("Couldn't connect PayPal. Try again.");
    expect(paypalConnectError(undefined)).toBe("Couldn't connect PayPal. Try again.");
  });
});
