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
    const subscriptions = await calendarService.listSubscriptions(user.id);
    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error("List calendar subscriptions error:", error);
    return calendarErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      url?: string;
      sync?: boolean;
    };
    const result = await calendarService.addSubscription(user.id, {
      name: body.name ?? "",
      url: body.url ?? "",
      sync: body.sync,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Add calendar subscription error:", error);
    return calendarErrorResponse(error);
  }
}
