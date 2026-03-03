import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get current user - adapt this based on your auth implementation
 */
async function getCurrentUser(request: NextRequest) {
  // This is a placeholder - adapt to your authentication system
  // You might use Supabase, NextAuth, or another auth provider
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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    // Check if already onboarded
    if (user.stripe_connect_id) {
      return NextResponse.json(
        {
          error: "User already has Stripe Connect account",
          stripe_account_id: user.stripe_connect_id,
        },
        { status: 400 }
      );
    }

    // Create Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      country: "US",
      business_type: "individual",
      individual: {
        email: user.email,
        first_name: user.name.split(" ")[0],
        last_name: user.name.split(" ").slice(1).join(" ") || "User",
      },
      metadata: {
        brokeBestiesUserId: user.id,
      },
    });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/stripe/refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/stripe/callback`,
    });

    // Update user with Stripe account ID
    await prisma.user.update({
      where: { id: user.id },
      data: { stripe_connect_id: account.id },
    });

    return NextResponse.json({
      onboarding_url: accountLink.url,
      stripe_account_id: account.id,
    });
  } catch (error) {
    console.error("Stripe onboarding error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
