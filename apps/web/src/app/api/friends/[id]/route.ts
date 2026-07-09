import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";

// Delete a friendship (reject, cancel, or remove depending on status)
export async function DELETE(
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

    // Try to remove/cancel/reject based on the friendship state
    // The service methods will validate permissions
    try {
      await friendService.removeFriend(friendId, user.id);
      return NextResponse.json({ message: "Friend removed successfully" });
    } catch {
      // If remove fails, try cancel (for sent requests)
      try {
        await friendService.cancelFriendRequest(friendId, user.id);
        return NextResponse.json({
          message: "Friend request cancelled successfully",
        });
      } catch {
        // If cancel fails, try reject (for received requests)
        await friendService.rejectFriendRequest(friendId, user.id);
        return NextResponse.json({
          message: "Friend request rejected successfully",
        });
      }
    }
  } catch (error) {
    console.error("Delete friend error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message.includes("not found")) status = 404;
    if (message.includes("cannot")) status = 403;
    return NextResponse.json({ error: message }, { status });
  }
}
