import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";

// GET /api/friends/recent?limit=5 - Most recently updated friendships (limit 1-20)
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "", 10);
    const friends = await friendService.getRecentFriends(
      user.id,
      isNaN(limit) ? 5 : Math.min(20, Math.max(1, limit))
    );

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Get recent friends error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
