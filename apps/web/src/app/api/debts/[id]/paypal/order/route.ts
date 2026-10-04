import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { paypalErrorResponse } from "@/lib/paypal-http";
import { createRateLimiter } from "@/lib/rate-limit";
import { paypalService } from "@/services/paypal.service";

const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

// POST /api/debts/[id]/paypal/order - Start paying a debt with PayPal (borrower only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const debtId = Number(id);
    if (!Number.isInteger(debtId)) {
      return NextResponse.json({ error: "Invalid debt ID" }, { status: 400 });
    }

    const { allowed, retryAfterSeconds } = limiter.check(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many PayPal requests. Try again in a minute." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const body = await request.json().catch(() => null);
    const { paymentId, approveUrl } = await paypalService.createDebtOrder({
      debtId,
      userId: user.id,
      platform: body?.platform === "ios" ? "ios" : "web",
      appVariant: request.headers.get("x-app-variant"),
    });

    return NextResponse.json({ paymentId, approveUrl }, { status: 201 });
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
