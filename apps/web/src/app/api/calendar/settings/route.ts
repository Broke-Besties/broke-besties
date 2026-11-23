import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService } from "@/services/calendar.service";
import { calendarErrorResponse } from "../route-utils";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await calendarService.getSettings(user.id);
    return NextResponse.json({ settings });
  } catch (error) {
    return calendarErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { timezone?: string };
    if (!body.timezone) {
      return NextResponse.json(
        { error: "Timezone is required" },
        { status: 400 },
      );
    }
    const settings = await calendarService.setTimezone(user.id, body.timezone);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Update calendar settings error:", error);
    return calendarErrorResponse(error);
  }
}
