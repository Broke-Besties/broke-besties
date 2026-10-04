import { NextRequest, NextResponse } from "next/server";
import { paypalService } from "@/services/paypal.service";

// GET /paypal/return - PayPal Checkout return/cancel bridge (public): redirects to the debt page or the app
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // No try/catch: the service never throws here; it falls back to a safe redirect.
  const target = await paypalService.getReturnRedirect({
    paymentId: searchParams.get("pp"),
    orderToken: searchParams.get("token"),
    cancelled: searchParams.get("cancelled") === "1",
  });

  return NextResponse.redirect(new URL(target, request.url), 302);
}
