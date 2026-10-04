import { NextRequest, NextResponse } from "next/server";
import { paypalErrorResponse } from "@/lib/paypal-http";
import { paypalService, type PaypalWebhookEvent } from "@/services/paypal.service";

// POST /api/paypal/webhook - PayPal event notifications (public; signature verified with PayPal)
export async function POST(request: NextRequest) {
  // Verification embeds the raw body verbatim, so it must be the exact bytes and valid JSON.
  const rawBody = await request.text();
  let event: PaypalWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    if (!(await paypalService.verifyWebhookSignature(request.headers, rawBody))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    await paypalService.handleWebhook(event);
  } catch (error) {
    // Missing config is a 500, never an unverified pass-through. Any non-2xx makes
    // PayPal redeliver the event later; handling is idempotent.
    return paypalErrorResponse(error, { configStatus: 500 });
  }

  return NextResponse.json({ received: true });
}
