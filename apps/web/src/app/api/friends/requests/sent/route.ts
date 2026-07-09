import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";

// Get sent pending friend requests
export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await friendService.getSentRequests(user.id);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Get sent requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
