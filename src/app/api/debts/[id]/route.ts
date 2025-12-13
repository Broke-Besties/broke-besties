import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";

// GET /api/debts/[id] - Get a specific debt
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
    const debtId = parseInt(id);

    if (isNaN(debtId)) {
      return NextResponse.json({ error: "Invalid debt ID" }, { status: 400 });
    }

    const debt = await debtService.getDebtById(debtId, user.id);

    return NextResponse.json({ debt });
  } catch (error) {
    console.error("Error fetching debt:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Debt not found") status = 404;
    if (message === "You don't have permission to view this debt") status = 403;
    return NextResponse.json({ error: message }, { status });
  }
}

// PATCH /api/debts/[id] - Update a debt
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
    const debtId = parseInt(id);

    if (isNaN(debtId)) {
      return NextResponse.json({ error: "Invalid debt ID" }, { status: 400 });
    }

    const { amount, description, status } = await request.json();

    const debt = await debtService.updateDebt(debtId, user.id, {
      amount,
      description,
      status,
    });

    return NextResponse.json({
      message: "Debt updated successfully",
      debt,
    });
  } catch (error) {
    console.error("Error updating debt:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Debt not found") status = 404;
    if (
      message === "You don't have permission to update this debt" ||
      message === "Only the lender can update amount and description"
    ) {
      status = 403;
    }
    if (message === "Amount must be positive") status = 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/debts/[id] - Delete a debt
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
    const debtId = parseInt(id);

    if (isNaN(debtId)) {
      return NextResponse.json({ error: "Invalid debt ID" }, { status: 400 });
    }

    await debtService.deleteDebt(debtId, user.id);

    return NextResponse.json({
      message: "Debt deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting debt:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Debt not found") status = 404;
    if (message === "Only the lender can delete this debt") status = 403;
    return NextResponse.json({ error: message }, { status });
  }
}
