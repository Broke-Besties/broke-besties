import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { calendarService } from "@/services/calendar.service";
import { calendarErrorResponse } from "../route-utils";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      icsText?: string;
      source?: string;
    };
    const result = await calendarService.importIcs(user.id, {
      icsText: body.icsText ?? "",
      source: body.source ?? "ics",
    });
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    console.error("Import calendar error:", error);
    return calendarErrorResponse(error);
  }
}
