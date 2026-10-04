import { NextRequest, NextResponse } from "next/server";
import { PaypalConfigError } from "@/lib/paypal-errors";
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

  let verified: boolean;
  try {
    verified = await paypalService.verifyWebhookSignature(request.headers, rawBody);
  } catch (error) {
    if (!(error instanceof PaypalConfigError)) return paypalErrorResponse(error);
    return NextResponse.json({ error: "PayPal webhook is not configured" }, { status: 500 });
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await paypalService.handleWebhook(event);
  } catch (error) {
    // A 5xx makes PayPal redeliver the event later; handling is idempotent.
    return paypalErrorResponse(error, { configStatus: 500 });
  }

  return NextResponse.json({ received: true });
}
