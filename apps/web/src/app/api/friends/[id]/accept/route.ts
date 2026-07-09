import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";

// Accept a friend request
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const friendId = parseInt(id);

    if (isNaN(friendId)) {
      return NextResponse.json(
        { error: "Invalid friend ID" },
        { status: 400 }
      );
    }

    const friend = await friendService.acceptFriendRequest(friendId, user.id);

    return NextResponse.json({
      message: "Friend request accepted",
      friend,
    });
  } catch (error) {
    console.error("Accept friend request error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Friend request not found") status = 404;
    if (message === "You cannot accept this friend request") status = 403;
    return NextResponse.json({ error: message }, { status });
  }
}
