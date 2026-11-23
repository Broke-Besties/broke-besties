import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService, type CreateEventInput } from "@/services/calendar.service";
import { calendarErrorResponse, parseRange } from "../route-utils";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const range = parseRange(request.nextUrl.searchParams);
    const scope = request.nextUrl.searchParams.get("scope") ?? "all";

    if (scope === "mine") {
      const events = await calendarService.listMyEvents(user.id, range);
      return NextResponse.json({ events });
    }
    if (scope === "shared") {
      const events = await calendarService.listSharedWithMe(user.id, range);
      return NextResponse.json({ events });
    }

    const events = await calendarService.listCalendar(user.id, range);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("List calendar events error:", error);
    return calendarErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateEventInput;
    const event = await calendarService.createEvent(user.id, body);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Create calendar event error:", error);
    return calendarErrorResponse(error);
  }
}
