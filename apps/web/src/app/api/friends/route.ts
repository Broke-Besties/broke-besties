import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";

// Get accepted friends list
export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const friends = await friendService.getFriends(user.id);

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Get friends error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Send a friend request
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientId } = await request.json();

    const result = await friendService.sendFriendRequest(user.id, recipientId);

    const message = result.autoAccepted
      ? "Friend request accepted! You are now friends."
      : "Friend request sent successfully";

    return NextResponse.json(
      {
        message,
        friend: result.friend,
        autoAccepted: result.autoAccepted,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Send friend request error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (
      message === "Recipient ID is required" ||
      message === "You cannot send a friend request to yourself" ||
      message === "You are already friends with this user" ||
      message === "Friend request already exists"
    ) {
      status = 400;
    }
    if (message === "User not found") status = 404;
    return NextResponse.json({ error: message }, { status });
  }
}
