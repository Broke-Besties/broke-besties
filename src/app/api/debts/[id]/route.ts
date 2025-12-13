import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

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

    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: {
        lender: {
          select: { id: true, email: true },
        },
        borrower: {
          select: { id: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    if (!debt) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    // Verify user is either lender or borrower
    if (debt.lenderId !== user.id && debt.borrowerId !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to view this debt" },
        { status: 403 }
      );
    }

    return NextResponse.json({ debt });
  } catch (error) {
    console.error("Error fetching debt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    // Fetch existing debt
    const existingDebt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!existingDebt) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    // Verify user is either lender or borrower
    const isLender = existingDebt.lenderId === user.id;
    const isBorrower = existingDebt.borrowerId === user.id;

    if (!isLender && !isBorrower) {
      return NextResponse.json(
        { error: "You don't have permission to update this debt" },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: any = {};

    // Only lender can update amount and description
    if (amount !== undefined || description !== undefined) {
      if (!isLender) {
        return NextResponse.json(
          { error: "Only the lender can update amount and description" },
          { status: 403 }
        );
      }
      if (amount !== undefined) {
        if (amount <= 0) {
          return NextResponse.json(
            { error: "Amount must be positive" },
            { status: 400 }
          );
        }
        updateData.amount = amount;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
    }

    // Both lender and borrower can update status
    if (status !== undefined) {
      updateData.status = status;
    }

    // Update the debt
    const debt = await prisma.debt.update({
      where: { id: debtId },
      data: updateData,
      include: {
        lender: {
          select: { id: true, email: true },
        },
        borrower: {
          select: { id: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      message: "Debt updated successfully",
      debt,
    });
  } catch (error) {
    console.error("Error updating debt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    // Fetch existing debt
    const existingDebt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!existingDebt) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    // Only lender can delete the debt
    if (existingDebt.lenderId !== user.id) {
      return NextResponse.json(
        { error: "Only the lender can delete this debt" },
        { status: 403 }
      );
    }

    await prisma.debt.delete({
      where: { id: debtId },
    });

    return NextResponse.json({
      message: "Debt deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting debt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
