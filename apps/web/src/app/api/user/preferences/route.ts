import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { preferencesService } from "@/services/preferences.service";
import type { ThemePreference } from "@/lib/user-preferences";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await preferencesService.get(user.id);
  return NextResponse.json({ preferences });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { theme?: ThemePreference };
    if (!body.theme) {
      return NextResponse.json({ error: "Theme is required" }, { status: 400 });
    }
    const preferences = await preferencesService.setTheme(user.id, body.theme);
    return NextResponse.json({ preferences });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save preferences";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
