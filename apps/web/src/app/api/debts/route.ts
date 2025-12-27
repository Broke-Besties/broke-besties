import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";

// POST /api/debts - Create a new debt
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount, description, borrowerId, groupId } = await request.json();

    const debt = await debtService.createDebt({
      amount,
      description,
      lenderId: user.id,
      borrowerId,
      groupId,
    });

    return NextResponse.json(
      {
        message: "Debt created successfully",
        debt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating debt:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (
      message === "Valid amount is required" ||
      message === "Borrower ID is required" ||
      message === "Cannot create a debt to yourself"
    ) {
      status = 400;
    }
    if (message === "Borrower not found" || message === "Group not found") {
      status = 404;
    }
    if (message === "Both lender and borrower must be group members") {
      status = 403;
    }
    return NextResponse.json({ error: message }, { status });
  }
}

// GET /api/debts - List all debts for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as 'lending' | 'borrowing' | null;
    const groupIdParam = searchParams.get("groupId");
    const status = searchParams.get("status");

    const debts = await debtService.getUserDebts(user.id, {
      type,
      groupId: groupIdParam ? parseInt(groupIdParam) : null,
      status,
    });

    return NextResponse.json({ debts });
  } catch (error) {
    console.error("Error fetching debts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
