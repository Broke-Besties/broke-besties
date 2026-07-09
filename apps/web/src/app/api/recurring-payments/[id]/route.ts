import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { recurringPaymentService } from "@/services/recurring-payment.service";

// GET /api/recurring-payments/[id] - Get a specific recurring payment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
    }

    const recurringPayment = await recurringPaymentService.getRecurringPaymentById(paymentId, user.id);

    return NextResponse.json({ recurringPayment });
  } catch (error) {
    console.error("Error fetching recurring payment:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Recurring payment not found") status = 404;
    if (message === "You don't have permission to view this recurring payment") status = 403;
    return NextResponse.json({ error: message }, { status });
  }
}

// PATCH /api/recurring-payments/[id] - Update a recurring payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
    }

    const { amount, description, frequency, status } = await request.json();

    const recurringPayment = await recurringPaymentService.updateRecurringPayment(paymentId, user.id, {
      amount,
      description,
      frequency,
      status,
    });

    return NextResponse.json({
      message: "Recurring payment updated successfully",
      recurringPayment,
    });
  } catch (error) {
    console.error("Error updating recurring payment:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Recurring payment not found") status = 404;
    if (message === "You don't have permission to update this recurring payment") {
      status = 403;
    }
    if (
      message === "Amount must be positive" ||
      message === "Frequency must be at least 1 day" ||
      message === 'Status must be either "active" or "inactive"'
    ) {
      status = 400;
    }
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/recurring-payments/[id] - Delete a recurring payment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
    }

    await recurringPaymentService.deleteRecurringPayment(paymentId, user.id);

    return NextResponse.json({
      message: "Recurring payment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting recurring payment:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Recurring payment not found") status = 404;
    if (message === "Only the lender can delete this recurring payment") status = 403;
    return NextResponse.json({ error: message }, { status });
  }
}
