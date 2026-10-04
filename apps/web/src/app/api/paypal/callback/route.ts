import { NextRequest, NextResponse } from "next/server";
import { paypalService } from "@/services/paypal.service";

// GET /api/paypal/callback - Log in with PayPal returns here (public: the signed state names the user)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // No try/catch: the service maps every failure to an error redirect and never throws.
  const target = await paypalService.handleOAuthCallback({
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    error: searchParams.get("error"),
  });

  return NextResponse.redirect(new URL(target, request.url), 302);
}
