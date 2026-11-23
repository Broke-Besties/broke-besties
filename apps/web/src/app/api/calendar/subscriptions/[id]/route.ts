import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService } from "@/services/calendar.service";
import { calendarErrorResponse } from "../../route-utils";

export async function DELETE(
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
    const result = await calendarService.removeSubscription(
      subscriptionId,
      user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
