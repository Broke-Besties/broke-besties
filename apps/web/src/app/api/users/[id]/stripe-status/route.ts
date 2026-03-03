import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        stripe_connect_id: true,
        stripe_onboarding_completed: true,
        stripe_charges_enabled: true,
        stripe_account_verified_at: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      has_stripe_account: !!user.stripe_connect_id,
      onboarding_completed: user.stripe_onboarding_completed,
      charges_enabled: user.stripe_charges_enabled,
      verified_at: user.stripe_account_verified_at,
    });
  } catch (error) {
    console.error("Stripe status endpoint error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
