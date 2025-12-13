import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

// POST /api/debts - Create a new debt
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount, description, borrowerId, groupId } = await request.json();

    // Validation
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (!borrowerId) {
      return NextResponse.json(
        { error: "Borrower ID is required" },
        { status: 400 }
      );
    }

    // Prevent creating a debt to yourself
    if (borrowerId === user.id) {
      return NextResponse.json(
        { error: "Cannot create a debt to yourself" },
        { status: 400 }
      );
    }

    // Verify borrower exists
    const borrower = await prisma.user.findUnique({
      where: { id: borrowerId },
    });

    if (!borrower) {
      return NextResponse.json(
        { error: "Borrower not found" },
        { status: 404 }
      );
    }

    // If groupId is provided, verify the group exists and both users are members
    if (groupId) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            select: { userId: true },
          },
        },
      });

      if (!group) {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 }
        );
      }

      const memberIds = group.members.map((m) => m.userId);
      if (!memberIds.includes(user.id) || !memberIds.includes(borrowerId)) {
        return NextResponse.json(
          { error: "Both lender and borrower must be group members" },
          { status: 403 }
        );
      }
    }

    // Create the debt
    const debt = await prisma.debt.create({
      data: {
        amount,
        description: description || null,
        lenderId: user.id,
        borrowerId,
        groupId: groupId || null,
        status: "pending",
      },
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

    return NextResponse.json(
      {
        message: "Debt created successfully",
        debt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating debt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
    const type = searchParams.get("type"); // 'lending', 'borrowing', or null for both
    const groupId = searchParams.get("groupId");
    const status = searchParams.get("status"); // 'pending', 'paid', etc.

    // Build the where clause
    const where: any = {
      OR: [{ lenderId: user.id }, { borrowerId: user.id }],
    };

    // Apply filters
    if (type === "lending") {
      where.OR = [{ lenderId: user.id }];
    } else if (type === "borrowing") {
      where.OR = [{ borrowerId: user.id }];
    }

    if (groupId) {
      where.groupId = parseInt(groupId);
    }

    if (status) {
      where.status = status;
    }

    const debts = await prisma.debt.findMany({
      where,
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
      orderBy: {
        createdAt: "desc",
      },
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
