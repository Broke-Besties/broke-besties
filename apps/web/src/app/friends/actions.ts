"use server";

import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function sendFriendRequest(recipientId: string) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const result = await friendService.sendFriendRequest(user.id, recipientId);
    revalidatePath("/friends");
    return {
      success: true,
      friend: result.friend,
      autoAccepted: result.autoAccepted,
    };
  } catch (error) {
    console.error("Send friend request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send request",
    };
  }
}

export async function acceptFriendRequest(friendId: number) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const friend = await friendService.acceptFriendRequest(friendId, user.id);
    revalidatePath("/friends");
    return { success: true, friend };
  } catch (error) {
    console.error("Accept friend request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to accept request",
    };
  }
}

export async function rejectFriendRequest(friendId: number) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await friendService.rejectFriendRequest(friendId, user.id);
    revalidatePath("/friends");
    return { success: true };
  } catch (error) {
    console.error("Reject friend request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject request",
    };
  }
}

export async function cancelFriendRequest(friendId: number) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await friendService.cancelFriendRequest(friendId, user.id);
    revalidatePath("/friends");
    return { success: true };
  } catch (error) {
    console.error("Cancel friend request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel request",
    };
  }
}

export async function removeFriend(friendId: number) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await friendService.removeFriend(friendId, user.id);
    revalidatePath("/friends");
    return { success: true };
  } catch (error) {
    console.error("Remove friend error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove friend",
    };
  }
}
