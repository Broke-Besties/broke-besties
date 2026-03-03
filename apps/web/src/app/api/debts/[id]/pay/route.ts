import { createDebtPaymentSession } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get current user - adapt this based on your auth implementation
 */
async function getCurrentUser(request: NextRequest) {
  // This is a placeholder - adapt to your authentication system
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    throw new Error("Unauthorized: No user ID found");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    const { id } = await params;
    const debtId = parseInt(id);

    if (isNaN(debtId)) {
      return NextResponse.json({ error: "Invalid debt ID" }, { status: 400 });
    }

    // Get debt and verify ownership
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: { borrower: true, lender: true },
    });

    if (!debt) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    // Only borrower can initiate payment
    if (debt.borrowerId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if debt is already settled
    if (debt.status === "settled") {
      return NextResponse.json(
        { error: "Debt already settled" },
        { status: 400 }
      );
    }

    // Verify lender has completed Stripe setup
    if (!debt.lender.stripe_connect_id || !debt.lender.stripe_charges_enabled) {
      return NextResponse.json(
        { error: "Lender has not completed Stripe setup" },
        { status: 400 }
      );
    }

    // Create checkout session
    const session = await createDebtPaymentSession(debtId);

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error("Payment endpoint error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
