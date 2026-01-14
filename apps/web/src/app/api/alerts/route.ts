import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";

// GET /api/alerts - Get all active alerts for the current user (as borrower)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const alerts = await alertService.getActiveAlertsForBorrower(user.id);
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/alerts - Create a new alert
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { debtId, recurringPaymentId, message, deadline } = await request.json();

    // Must specify either debtId or recurringPaymentId, but not both
    if ((!debtId && !recurringPaymentId) || (debtId && recurringPaymentId)) {
      return NextResponse.json(
        { error: "Must specify either debtId or recurringPaymentId" },
        { status: 400 }
      );
    }

    let alert;

    if (debtId) {
      alert = await alertService.createAlertForDebt({
        debtId,
        message,
        deadline: deadline ? new Date(deadline) : null,
        userId: user.id,
      });
    } else {
      alert = await alertService.createAlertForRecurringPayment({
        recurringPaymentId,
        message,
        userId: user.id,
      });
    }

    return NextResponse.json(
      { message: "Alert created successfully", alert },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating alert:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (
      message.includes("not found") ||
      message.includes("Only the lender") ||
      message.includes("already has an alert")
    ) {
      status = 400;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
