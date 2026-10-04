import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// Not importOriginal: the real service imports the email service, which
// throws at import time without RESEND_API_KEY.
vi.mock("@/services/paypal.service", () => ({
  paypalService: { verifyWebhookSignature: vi.fn(), handleWebhook: vi.fn() },
}));

import { NextRequest } from "next/server";
import { PaypalConfigError } from "@/lib/paypal-errors";
import { paypalService } from "@/services/paypal.service";
import { POST as webhookRoute } from "@/app/api/paypal/webhook/route";

// Odd spacing on purpose: verification must get the bytes exactly as sent.
const rawEvent =
  '{"id":"WH-1",  "event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"CAP-1","custom_id":"pay_1"}}\n';

function deliver(body = rawEvent) {
  return webhookRoute(
    new NextRequest("https://brokebesties.app/api/paypal/webhook", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "paypal-transmission-id": "T-1" },
    }),
  );
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.resetAllMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("POST /api/paypal/webhook (public)", () => {
  it("verifies the raw body and headers, then hands the parsed event to the service", async () => {
    vi.mocked(paypalService.verifyWebhookSignature).mockResolvedValue(true);
    vi.mocked(paypalService.handleWebhook).mockResolvedValue({ handled: true });

    const res = await deliver();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const [headers, body] = vi.mocked(paypalService.verifyWebhookSignature).mock.calls[0];
    expect(headers.get("paypal-transmission-id")).toBe("T-1");
    expect(body).toBe(rawEvent);
    expect(paypalService.handleWebhook).toHaveBeenCalledWith(JSON.parse(rawEvent));
  });

  it("answers 200 for events that aren't ours", async () => {
    vi.mocked(paypalService.verifyWebhookSignature).mockResolvedValue(true);
    vi.mocked(paypalService.handleWebhook).mockResolvedValue({ handled: false });

    const res = await deliver();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it("rejects a bad signature with 400 and handles nothing", async () => {
    vi.mocked(paypalService.verifyWebhookSignature).mockResolvedValue(false);

    const res = await deliver();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid signature" });
    expect(paypalService.handleWebhook).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't JSON with 400, before asking PayPal", async () => {
    const res = await deliver("event=PAYMENT.CAPTURE.COMPLETED");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid payload" });
    expect(paypalService.verifyWebhookSignature).not.toHaveBeenCalled();
    expect(paypalService.handleWebhook).not.toHaveBeenCalled();
  });

  it.each([
    [new PaypalConfigError("PAYPAL_WEBHOOK_ID is not set"), "PayPal webhook is not configured"],
    [new Error("getaddrinfo ENOTFOUND api-m.sandbox.paypal.com"), "Internal server error"],
  ])("answers 500 when verification throws %s", async (error, message) => {
    vi.mocked(paypalService.verifyWebhookSignature).mockRejectedValue(error);

    const res = await deliver();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: message });
    expect(consoleError).toHaveBeenCalled();
    expect(paypalService.handleWebhook).not.toHaveBeenCalled();
  });

  it.each([
    [new Error("deadlock detected on PaypalPayment"), "Internal server error"],
    [new PaypalConfigError("PAYPAL_CLIENT_SECRET is not set"), "PayPal is not configured"],
  ])("answers 500 so PayPal retries when handling throws %s", async (error, message) => {
    vi.mocked(paypalService.verifyWebhookSignature).mockResolvedValue(true);
    vi.mocked(paypalService.handleWebhook).mockRejectedValue(error);

    const res = await deliver();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: message });
  });
});
