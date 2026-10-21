import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/services/wallet.service", () => ({
  walletService: { completeDeposit: vi.fn(), failDeposit: vi.fn() },
}));

import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { walletService } from "@/services/wallet.service";
import { POST as stripeWebhookRoute } from "@/app/api/stripe/webhook/route";

const constructEvent = vi.fn();
const session = { id: "cs_test_1" };
const completedEvent = {
  type: "checkout.session.completed",
  data: { object: session },
};

function webhookRequest(body: string, signature?: string) {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.mocked(getStripe).mockReturnValue({ webhooks: { constructEvent } } as never);
    constructEvent.mockReturnValue(completedEvent);
  });

  it("returns 500 without processing an unsigned event when the secret isn't configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const res = await stripeWebhookRoute(webhookRequest(JSON.stringify(completedEvent)));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Stripe webhook secret is not configured" });
    expect(walletService.completeDeposit).not.toHaveBeenCalled();
  });

  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await stripeWebhookRoute(webhookRequest(JSON.stringify(completedEvent)));

    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(walletService.completeDeposit).not.toHaveBeenCalled();
  });

  it("returns 400 when the signature doesn't verify", async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const res = await stripeWebhookRoute(webhookRequest("{}", "t=1,v1=bad"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid signature" });
    expect(walletService.completeDeposit).not.toHaveBeenCalled();
  });

  it("verifies the raw body and completes the deposit", async () => {
    const body = JSON.stringify(completedEvent);

    const res = await stripeWebhookRoute(webhookRequest(body, "t=1,v1=good"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(constructEvent).toHaveBeenCalledWith(body, "t=1,v1=good", "whsec_test");
    expect(walletService.completeDeposit).toHaveBeenCalledWith(session);
  });

  it("fails the deposit when the checkout session expires", async () => {
    constructEvent.mockReturnValueOnce({
      type: "checkout.session.expired",
      data: { object: session },
    });

    const res = await stripeWebhookRoute(webhookRequest("{}", "t=1,v1=good"));

    expect(res.status).toBe(200);
    expect(walletService.failDeposit).toHaveBeenCalledWith(session);
  });
});
