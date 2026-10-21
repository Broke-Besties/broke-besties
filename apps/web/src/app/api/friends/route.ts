import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";
import { userService } from "@/services/user.service";

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
      { status: 500 },
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

    // Either { recipientId } or { email } (the mobile app's add-by-email form).
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { recipientId, email } = body;

    if (email !== undefined && (typeof email !== "string" || !email.trim())) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (email === undefined && typeof recipientId !== "string") {
      return NextResponse.json({ error: "Recipient ID is required" }, { status: 400 });
    }

    console.log("[Friend API] POST /friends - Sending friend request", {
      senderId: user.id,
      recipientId,
      recipientIdType: typeof recipientId,
    });

    const result = await friendService.sendFriendRequest(
      user.id,
      email === undefined
        ? recipientId
        : (await userService.searchUserByEmail(email.trim().toLowerCase())).id,
    );

    const message = result.autoAccepted
      ? "Friend request accepted! You are now friends."
      : "Friend request sent successfully";

    return NextResponse.json(
      {
        message,
        friend: result.friend,
        autoAccepted: result.autoAccepted,
      },
      { status: 201 },
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
