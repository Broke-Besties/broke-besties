"use server";

import { getUser } from "@/lib/supabase";
import { inviteService } from "@/services/invite.service";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { userService } from "@/services/user.service";
import { groupService } from "@/services/group.service";
import { friendService } from "@/services/friend.service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createInvite(groupId: number, invitedEmail: string) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const invite = await inviteService.createInvite(
      user.id,
      groupId,
      invitedEmail
    );
    revalidatePath(`/groups/${groupId}`);
    return { success: true, invite };
  } catch (error) {
    console.error("Create invite error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create invite",
    };
  }
}

export async function cancelInvite(groupId: number, inviteId: number) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await inviteService.cancelInvite(user.id, inviteId);
    revalidatePath(`/groups/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Cancel invite error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel invite",
    };
  }
}

export async function createDebt(data: {
  amount: number;
  description?: string;
  borrowerId: string;
  groupId: number;
  receiptIds?: string[];
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const debt = await debtService.createDebt({
      amount: data.amount,
      description: data.description,
      lenderId: user.id,
      borrowerId: data.borrowerId,
      groupId: data.groupId,
      receiptIds: data.receiptIds,
    });
    if (data.groupId) {
      revalidatePath(`/groups/${data.groupId}`);
    }
    revalidatePath("/dashboard");
    return { success: true, debt };
  } catch (error) {
    console.error("Create debt error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create debt",
    };
  }
}

export async function createDebts(
  debts: Array<{
    amount: number;
    description?: string;
    borrowerId: string;
    groupId: number;
    receiptIds?: string[];
  }>
) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const createdDebts = await Promise.all(
      debts.map((data) =>
        debtService.createDebt({
          amount: data.amount,
          description: data.description,
          lenderId: user.id,
          borrowerId: data.borrowerId,
          groupId: data.groupId,
          receiptIds: data.receiptIds,
        })
      )
    );

    // Revalidate paths for all groups
    const groupIds = [...new Set(debts.map((d) => d.groupId).filter(Boolean))];
    groupIds.forEach((groupId) => {
      revalidatePath(`/groups/${groupId}`);
    });
    revalidatePath("/dashboard");

    return { success: true, debts: createdDebts };
  } catch (error) {
    console.error("Create debts error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create debts",
    };
  }
}

export async function updateDebtStatus(debtId: number, status: string) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const debt = await debtService.updateDebt(debtId, user.id, { status });
    revalidatePath("/dashboard");
    return { success: true, debt };
  } catch (error) {
    console.error("Update debt error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update debt",
    };
  }
}

export async function searchUserByEmail(email: string) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const foundUser = await userService.searchUserByEmail(email);
    return { success: true, user: foundUser };
  } catch (error) {
    console.error("Search user error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "User not found",
    };
  }
}

export async function searchGroupMembers(groupId: number, query: string) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const members = await groupService.searchGroupMembers(
      groupId,
      user.id,
      query
    );
    return { success: true, members };
  } catch (error) {
    console.error("Search group members error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to search members",
      members: [],
    };
  }
}

// Debt Transaction Actions

export async function createDebtTransaction(data: {
  debtId: number;
  type: "drop" | "modify" | "confirm_paid";
  proposedAmount?: number;
  proposedDescription?: string;
  reason?: string;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const transaction = await debtTransactionService.createTransaction({
      debtId: data.debtId,
      type: data.type,
      requesterId: user.id,
      proposedAmount: data.proposedAmount,
      proposedDescription: data.proposedDescription,
      reason: data.reason,
    });
    revalidatePath("/dashboard");
    revalidatePath("/debt-transactions");
    revalidatePath(`/debts/${data.debtId}`);
    return { success: true, transaction };
  } catch (error) {
    console.error("Create debt transaction error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create transaction",
    };
  }
}

export async function respondToDebtTransaction(
  transactionId: number,
  approve: boolean
) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const result = await debtTransactionService.respondToTransaction({
      transactionId,
      userId: user.id,
      approve,
    });
    revalidatePath("/dashboard");
    revalidatePath("/debt-transactions");
    return { success: true, ...result };
  } catch (error) {
    console.error("Respond to debt transaction error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to respond to transaction",
    };
  }
}

export async function cancelDebtTransaction(transactionId: number) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const transaction = await debtTransactionService.cancelTransaction(
      transactionId,
      user.id
    );
    revalidatePath("/dashboard");
    revalidatePath("/debt-transactions");
    return { success: true, transaction };
  } catch (error) {
    console.error("Cancel debt transaction error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to cancel transaction",
    };
  }
}

export async function getPendingTransactionCount() {
  const user = await getUser();

  if (!user) {
    return { count: 0 };
  }

  try {
    const count = await debtTransactionService.getPendingCountForUser(user.id);
    return { count };
  } catch (error) {
    console.error("Get pending transaction count error:", error);
    return { count: 0 };
  }
}

// Friend Invite Actions

export async function getRecentFriends(groupId: number) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    // Get recent friends
    const friends = await friendService.getRecentFriends(user.id, 5);

    // Get current group members to exclude them
    const group = await groupService.getGroupById(groupId, user.id);
    const memberIds = new Set(
      group.members.map((m: { user: { id: string } }) => m.user.id)
    );

    // Filter out friends who are already members
    const availableFriends = friends.filter((f) => !memberIds.has(f.friend.id));

    return {
      success: true,
      friends: availableFriends.map((f) => ({
        id: f.id,
        userId: f.friend.id,
        name: f.friend.name,
        email: f.friend.email,
      })),
    };
  } catch (error) {
    console.error("Get recent friends error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get friends",
      friends: [],
    };
  }
}

export async function searchFriendsForInvite(groupId: number, query: string) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    // Search friends by name or email
    const friends = await friendService.searchFriends(user.id, query);

    // Get current group members to exclude them
    const group = await groupService.getGroupById(groupId, user.id);
    const memberIds = new Set(
      group.members.map((m: { user: { id: string } }) => m.user.id)
    );

    // Filter out friends who are already members
    const availableFriends = friends.filter((f) => !memberIds.has(f.friend.id));

    return {
      success: true,
      friends: availableFriends.map((f) => ({
        id: f.id,
        userId: f.friend.id,
        name: f.friend.name,
        email: f.friend.email,
      })),
    };
  } catch (error) {
    console.error("Search friends error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to search friends",
      friends: [],
    };
  }
}

export async function addFriendToGroup(groupId: number, friendUserId: string) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    // Add friend directly to the group (no invite required)
    const member = await inviteService.createInviteAsFriend(
      user.id,
      groupId,
      friendUserId
    );
    revalidatePath(`/groups/${groupId}`);
    return { success: true, member };
  } catch (error) {
    console.error("Add friend to group error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to add friend to group",
    };
  }
}
