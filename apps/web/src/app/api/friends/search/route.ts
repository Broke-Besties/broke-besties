import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";

// GET /api/friends/search?q= - Search accepted friends by name or email
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friends = await friendService.searchFriends(
      user.id,
      searchParams.get("q") ?? ""
    );

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Search friends error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
