import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { publishPaymentSuccess } from "@/events/producer";

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Not available in production" },
        { status: 403 }
      );
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { debtId, amount, providerType } = await request.json();

    if (!debtId || !amount) {
      return NextResponse.json(
        { error: "debtId and amount are required" },
        { status: 400 }
      );
    }

    await publishPaymentSuccess({
      debtId: Number(debtId),
      amount: Number(amount),
      providerType: providerType || "mock",
      providerReference: `mock_${Date.now()}`,
      timestamp: new Date(),
    });

    return NextResponse.json({
      message: "Mock payment event published to Kafka",
      debtId,
      amount,
    });
  } catch (error) {
    console.error("Error publishing mock event:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
