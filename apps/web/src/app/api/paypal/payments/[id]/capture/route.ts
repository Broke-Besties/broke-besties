import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { paypalErrorResponse } from "@/lib/paypal-http";
import { createRateLimiter } from "@/lib/rate-limit";
import { paypalService } from "@/services/paypal.service";

// Each declined or not-approved capture renews the PayPal-Request-Id, so every retry is a fresh
// capture call at PayPal.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

// POST /api/paypal/payments/[id]/capture - Capture an approved PayPal payment (payer only, idempotent)
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, retryAfterSeconds } = limiter.check(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many PayPal requests. Try again in a minute." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const { id } = await params;
    const result = await paypalService.capturePayment(id, user.id);

    return result.httpStatus === 200
      ? NextResponse.json({ payment: result.payment, debt: result.debt })
      : NextResponse.json({ payment: result.payment }, { status: 202 });
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
