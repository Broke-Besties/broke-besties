import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService } from "@/services/calendar.service";
import { calendarErrorResponse } from "../route-utils";

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      personalColor?: string | null;
      groups?: Array<{ groupId: number; color: string | null }>;
    };
    const result = await calendarService.setColors(user.id, {
      personalColor: body.personalColor,
      groups: body.groups,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Update calendar colors error:", error);
    return calendarErrorResponse(error);
  }
}
