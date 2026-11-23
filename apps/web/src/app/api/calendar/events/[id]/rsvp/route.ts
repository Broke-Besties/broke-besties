import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService, type RsvpResponse } from "@/services/calendar.service";
import { calendarErrorResponse } from "../../../route-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as { response?: RsvpResponse };
    const event = await calendarService.rsvpEvent(
      id,
      user.id,
      body.response as RsvpResponse,
    );
    return NextResponse.json({ event });
  } catch (error) {
    console.error("RSVP error:", error);
    return calendarErrorResponse(error);
  }
}
