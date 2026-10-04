import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { paypalErrorResponse } from "@/lib/paypal-http";
import { paypalService } from "@/services/paypal.service";

// GET /api/paypal/connect?platform=ios|web - Log in with PayPal URL for the user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = paypalService.buildConnectUrl({
      userId: user.id,
      platform: searchParams.get("platform") === "ios" ? "ios" : "web",
      appVariant: request.headers.get("x-app-variant"),
    });

    return NextResponse.json({ url });
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
