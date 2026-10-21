import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { getNavCounts } from "@/lib/nav-counts";

// GET /api/me/counts - Badge counts: debt requests, invites, friend requests
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await getNavCounts(user.id, user.email ?? ""));
  } catch (error) {
    console.error("Get nav counts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
