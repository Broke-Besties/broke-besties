import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { recurringPaymentService } from "@/services/recurring-payment.service";

// POST /api/recurring-payments - Create a new recurring payment
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount, description, frequency, borrowers } = await request.json();

    const recurringPayment = await recurringPaymentService.createRecurringPayment({
      amount,
      description,
      frequency,
      lenderId: user.id,
      borrowers,
    });

    return NextResponse.json(
      {
        message: "Recurring payment created successfully",
        recurringPayment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating recurring payment:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (
      message === "Valid amount is required" ||
      message === "Frequency must be at least 1 day" ||
      message === "At least one borrower is required" ||
      message === "Split percentages must sum to 100%" ||
      message === "All split percentages must be positive" ||
      message === "Cannot add the same borrower multiple times"
    ) {
      status = 400;
    }
    if (message.includes("not found")) {
      status = 404;
    }
    return NextResponse.json({ error: message }, { status });
  }
}

// GET /api/recurring-payments - List all recurring payments for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as 'lending' | 'borrowing' | null;
    const status = searchParams.get("status") as 'active' | 'inactive' | null;

    const recurringPayments = await recurringPaymentService.getUserRecurringPayments(user.id, {
      type,
      status,
    });

    return NextResponse.json({ recurringPayments });
  } catch (error) {
    console.error("Error fetching recurring payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
