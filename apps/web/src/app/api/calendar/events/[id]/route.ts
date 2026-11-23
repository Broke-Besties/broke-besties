import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService, type UpdateEventInput } from "@/services/calendar.service";
import { calendarErrorResponse } from "../../route-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const event = await calendarService.getEventForUser(id, user.id);
    return NextResponse.json({ event });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateEventInput;
    const event = await calendarService.updateEvent(id, user.id, body);
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Update calendar event error:", error);
    return calendarErrorResponse(error);
  }
}

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
    const result = await calendarService.deleteEvent(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return calendarErrorResponse(error);
  }
}
