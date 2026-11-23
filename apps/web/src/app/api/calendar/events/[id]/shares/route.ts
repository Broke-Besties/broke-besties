import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService, type EventShareInput } from "@/services/calendar.service";
import { calendarErrorResponse } from "../../../route-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as { shares?: EventShareInput[] };
    const event = await calendarService.setShares(
      id,
      user.id,
      body.shares ?? [],
    );
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Update calendar shares error:", error);
    return calendarErrorResponse(error);
  }
}
