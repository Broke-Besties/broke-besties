import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { isPaypalConfigured } from "@/lib/paypal";
import { paypalErrorResponse } from "@/lib/paypal-http";
import { paypalService } from "@/services/paypal.service";

// GET /api/paypal/account - The user's linked PayPal account (or null), and whether
// PayPal is configured on this server (clients hide the PayPal card when it isn't)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await paypalService.getAccount(user.id);

    return NextResponse.json({ account, enabled: isPaypalConfigured() });
  } catch (error) {
    return paypalErrorResponse(error);
  }
}

// DELETE /api/paypal/account - Unlink the user's PayPal account
export async function DELETE() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await paypalService.disconnect(user.id);

    return NextResponse.json({ message: "PayPal disconnected" });
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
