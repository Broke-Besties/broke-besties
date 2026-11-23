import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService } from "@/services/calendar.service";
import { calendarErrorResponse } from "../../../route-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const subscriptionId = Number.parseInt(id, 10);
    if (Number.isNaN(subscriptionId)) {
      return NextResponse.json(
        { error: "Invalid subscription id" },
        { status: 400 },
      );
    }
    const result = await calendarService.syncSubscription(
      subscriptionId,
      user.id,
    );
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Sync calendar subscription error:", error);
    return calendarErrorResponse(error);
  }
}
