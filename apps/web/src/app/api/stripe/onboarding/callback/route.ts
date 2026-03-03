import { stripe } from "@/lib/stripe";
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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    // Verify account was created
    if (!user.stripe_connect_id) {
      return NextResponse.redirect(
        new URL(
          `/settings/stripe?error=no_account`,
          process.env.NEXT_PUBLIC_APP_URL
        )
      );
    }

    // Retrieve account details to check verification status
    const account = await stripe.accounts.retrieve(user.stripe_connect_id);

    // Check if charges are enabled (verification complete)
    const chargesEnabled = account.charges_enabled === true;
    const currentlyDue = account.requirements?.currently_due ?? [];
    const onboardingComplete = currentlyDue.length === 0 && chargesEnabled;

    // Update user with verification status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripe_onboarding_completed: onboardingComplete,
        stripe_charges_enabled: chargesEnabled,
        stripe_account_verified_at: chargesEnabled ? new Date() : null,
      },
    });

    // Redirect to settings with status
    const status = chargesEnabled
      ? "verified"
      : onboardingComplete
        ? "pending_activation"
        : "pending_verification";

    return NextResponse.redirect(
      new URL(
        `/settings/stripe?status=${status}`,
        process.env.NEXT_PUBLIC_APP_URL
      )
    );
  } catch (error) {
    console.error("Stripe onboarding callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/settings/stripe?error=callback_failed`,
        process.env.NEXT_PUBLIC_APP_URL
      )
    );
  }
}
