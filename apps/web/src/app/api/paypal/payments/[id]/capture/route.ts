import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { paypalErrorResponse } from "@/lib/paypal-http";
import { paypalService } from "@/services/paypal.service";

// POST /api/paypal/payments/[id]/capture - Capture an approved PayPal payment (payer only, idempotent)
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
