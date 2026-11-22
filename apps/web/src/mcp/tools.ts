import { z } from "zod";

import { debtService } from "@/services/debt.service";
import { friendService } from "@/services/friend.service";
import { groupService } from "@/services/group.service";
import { userService } from "@/services/user.service";
import { defineTool, type McpToolDefinition } from "./types";

type Party = {
  id: string;
  name?: string;
  email: string;
  signedUp?: boolean;
};

type DebtViewSource = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  lenderId: string;
  borrowerId: string;
  createdAt: Date | string;
  group?: { id: number; name: string } | null;
  lender: Party;
  borrower: Party;
};

type GroupViewSource = {
  id: number;
  name: string;
  members: Array<{ user: Party }>;
};

type FriendViewSource = {
  id: number;
  createdAt: Date | string;
  requester: Party;
  recipient: Party;
  requesterId: string;
  recipientId: string;
};

function debtView(debt: DebtViewSource, userId: string) {
  const isLender = debt.lenderId === userId;
  const counterparty = isLender ? debt.borrower : debt.lender;

  return {
    id: debt.id,
    amount: debt.amount,
    description: debt.description,
    status: debt.status,
    direction: isLender ? "you_are_owed" : "you_owe",
    counterparty: {
      id: counterparty.id,
      name: counterparty.name,
      email: counterparty.email,
      signedUp: counterparty.signedUp,
    },
    group: debt.group
      ? { id: debt.group.id, name: debt.group.name }
      : null,
    createdAt: debt.createdAt,
  };
}

function groupView(group: GroupViewSource) {
  return {
    id: group.id,
    name: group.name,
    memberCount: group.members.length,
    members: group.members.map(({ user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      signedUp: user.signedUp,
    })),
  };
}

function friendView(friendship: FriendViewSource, userId: string) {
  const friend =
    friendship.requesterId === userId
      ? friendship.recipient
      : friendship.requester;

  return {
    friendshipId: friendship.id,
    id: friend.id,
    name: friend.name,
    email: friend.email,
    signedUp: friend.signedUp,
    friendsSince: friendship.createdAt,
  };
}

function requestView(request: FriendViewSource) {
  return {
    requestId: request.id,
    requester: {
      id: request.requester.id,
      name: request.requester.name,
      email: request.requester.email,
    },
    recipient: {
      id: request.recipient.id,
      name: request.recipient.name,
      email: request.recipient.email,
    },
    createdAt: request.createdAt,
  };
}

export const toolDefinitions: McpToolDefinition[] = [
  defineTool({
    name: "get_me",
    title: "Get current user",
    description:
      "Returns the signed-in Broke Besties user's id, name, email, and premium status.",
    schema: {},
    handler: async (_args, { userId }) => {
      const user = await userService.getUserById(userId);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        premium: user.premium,
        signedUp: user.signedUp,
      };
    },
  }),

  defineTool({
    name: "list_groups",
    title: "List groups",
    description:
      "Lists every group the user belongs to, including members (id, name, email). Use this before creating a debt tied to a group.",
    schema: {},
    handler: async (_args, { userId }) => {
      const groups = await groupService.getUserGroups(userId);
      return groups.map((group) => groupView(group as GroupViewSource));
    },
  }),

  defineTool({
    name: "get_group",
    title: "Get group",
    description:
      "Returns one group the user belongs to, including its members and pending invites.",
    schema: {
      groupId: z.number().int().positive().describe("The group id"),
    },
    handler: async ({ groupId }, { userId }) => {
      const group = await groupService.getGroupById(groupId, userId);
      return {
        ...groupView(group as GroupViewSource),
        pendingInvites: group.invites.map((invite) => ({
          email: invite.invitedEmail,
          invitedAt: invite.createdAt,
        })),
      };
    },
  }),

  defineTool({
    name: "list_friends",
    title: "List friends",
    description:
      "Lists the user's accepted friends, including ids, names, emails, and whether they have signed up.",
    schema: {},
    handler: async (_args, { userId }) => {
      const friends = await friendService.getFriends(userId);
      return friends.map((friendship) =>
        friendView(friendship as FriendViewSource, userId),
      );
    },
  }),

  defineTool({
    name: "list_friend_requests",
    title: "List friend requests",
    description:
      "Lists pending friend requests, either incoming (need the user's response) or sent by the user.",
    schema: {
      direction: z
        .enum(["incoming", "sent"])
        .optional()
        .describe("Which requests to list; defaults to incoming"),
    },
    handler: async ({ direction }, { userId }) => {
      const requests =
        direction === "sent"
          ? await friendService.getSentRequests(userId)
          : await friendService.getPendingRequests(userId);
      return requests.map((request) =>
        requestView(request as FriendViewSource),
      );
    },
  }),

  defineTool({
    name: "list_debts",
    title: "List debts",
    description:
      "Lists the user's debts. Filter by whether the user lent money, borrowed money, or both, and by status.",
    schema: {
      type: z
        .enum(["all", "lending", "borrowing"])
        .optional()
        .describe("Defaults to all debts involving the user"),
      status: z
        .enum(["pending", "paid"])
        .optional()
        .describe("Only include debts with this status"),
    },
    handler: async ({ type, status }, { userId }) => {
      const debts = await debtService.getUserDebts(userId, {
        type: type === "all" ? null : type ?? null,
        status: status ?? null,
      });
      return debts.map((debt) => debtView(debt as DebtViewSource, userId));
    },
  }),

  defineTool({
    name: "get_debt",
    title: "Get debt",
    description: "Returns full details for one debt the user is involved in.",
    schema: {
      debtId: z.number().int().positive().describe("The debt id"),
    },
    handler: async ({ debtId }, { userId }) => {
      const debt = await debtService.getDebtById(debtId, userId);
      return {
        ...debtView(debt as DebtViewSource, userId),
        receipts: debt.receipts.map((receipt) => ({
          id: receipt.id,
          createdAt: receipt.createdAt,
        })),
      };
    },
  }),

  defineTool({
    name: "get_balance_summary",
    title: "Get balance summary",
    description:
      "Sums the user's outstanding (pending) debts: total owed to the user, total the user owes, and the net balance.",
    schema: {},
    handler: async (_args, { userId }) => {
      const debts = await debtService.getUserDebts(userId, {
        status: "pending",
      });
      const lent = debts
        .filter((debt) => debt.lenderId === userId)
        .reduce((sum, debt) => sum + debt.amount, 0);
      const borrowed = debts
        .filter((debt) => debt.borrowerId === userId)
        .reduce((sum, debt) => sum + debt.amount, 0);

      return {
        currency: "CAD",
        totalOwedToYou: Math.round(lent * 100) / 100,
        totalYouOwe: Math.round(borrowed * 100) / 100,
        net: Math.round((lent - borrowed) * 100) / 100,
        pendingDebts: debts.length,
      };
    },
  }),

  defineTool({
    name: "list_group_debts",
    title: "List group debts",
    description:
      "Lists every debt recorded in a group the user belongs to, including the parties involved.",
    schema: {
      groupId: z.number().int().positive().describe("The group id"),
    },
    handler: async ({ groupId }, { userId }) => {
      const debts = await debtService.getGroupDebts(groupId, userId);
      return debts.map((debt) => ({
        ...debtView(debt as DebtViewSource, userId),
        lender: debt.lender,
        borrower: debt.borrower,
      }));
    },
  }),

  defineTool({
    name: "create_debt",
    title: "Create debt",
    description:
      "Creates a debt where the signed-in user is the lender. Identify the borrower by id or email. Email can be someone who has not signed up yet. Optionally attach the debt to a group and receipts.",
    schema: {
      amount: z
        .number()
        .positive()
        .describe("Amount in CAD, greater than zero"),
      description: z
        .string()
        .min(1)
        .optional()
        .describe("What the debt is for"),
      borrowerId: z
        .string()
        .optional()
        .describe("Borrower's user id (from list_friends)"),
      borrowerEmail: z
        .string()
        .email()
        .optional()
        .describe("Borrower's email, if their id is unknown"),
      groupId: z.number().int().positive().optional().describe("Group id"),
      receiptIds: z
        .array(z.string())
        .optional()
        .describe("Receipt ids to attach"),
    },
    handler: async (
      { amount, description, borrowerId, borrowerEmail, groupId, receiptIds },
      { userId },
    ) => {
      if (!!borrowerId === !!borrowerEmail) {
        throw new Error("Provide exactly one of borrowerId or borrowerEmail");
      }

      if (groupId) {
        await groupService.getGroupById(groupId, userId);
      }

      const resolvedBorrowerId = borrowerId
        ? borrowerId
        : (
            await userService.findOrCreatePlaceholderByEmail(
              borrowerEmail as string,
            )
          ).id;

      const debt = await debtService.createDebt({
        amount,
        description: description ?? null,
        lenderId: userId,
        borrowerId: resolvedBorrowerId,
        groupId: groupId ?? null,
        receiptIds,
      });

      return debtView(debt as DebtViewSource, userId);
    },
  }),

  defineTool({
    name: "update_debt",
    title: "Update debt",
    description:
      "Updates a debt's amount or description (lender only) or marks it pending/paid. Use this to settle a debt by setting status to paid.",
    schema: {
      debtId: z.number().int().positive().describe("The debt id"),
      amount: z.number().positive().optional(),
      description: z.string().optional(),
      status: z.enum(["pending", "paid"]).optional(),
    },
    handler: async ({ debtId, amount, description, status }, { userId }) => {
      if (amount === undefined && description === undefined && status === undefined) {
        throw new Error("Provide at least one field to update");
      }

      const debt = await debtService.updateDebt(debtId, userId, {
        amount,
        description,
        status,
      });
      return debtView(debt as DebtViewSource, userId);
    },
  }),

  defineTool({
    name: "delete_debt",
    title: "Delete debt",
    description:
      "Permanently deletes a debt. Only the lender can delete a debt.",
    schema: {
      debtId: z.number().int().positive().describe("The debt id"),
    },
    handler: async ({ debtId }, { userId }) => {
      await debtService.deleteDebt(debtId, userId);
      return { success: true, debtId };
    },
  }),

  defineTool({
    name: "create_group",
    title: "Create group",
    description:
      "Creates a new group with the signed-in user as its first member.",
    schema: {
      name: z.string().min(1).max(80).describe("Group name"),
    },
    handler: async ({ name }, { userId }) => {
      const group = await groupService.createGroup(userId, name.trim());
      return groupView(group as GroupViewSource);
    },
  }),

  defineTool({
    name: "send_friend_request",
    title: "Send friend request",
    description:
      "Sends a friend request by email. People who have not signed up yet are added immediately as placeholders.",
    schema: {
      email: z.string().email().describe("Friend's email"),
    },
    handler: async ({ email }, { userId }) => {
      const result = await friendService.sendFriendRequestByEmail(
        userId,
        email,
      );
      return {
        autoAccepted: result.autoAccepted ?? false,
        notSignedUp: result.notSignedUp ?? false,
        friendshipId: result.friend.id,
        friend: result.friend,
      };
    },
  }),

  defineTool({
    name: "accept_friend_request",
    title: "Accept friend request",
    description: "Accepts an incoming friend request by its request id.",
    schema: {
      requestId: z.number().int().positive().describe("The request id"),
    },
    handler: async ({ requestId }, { userId }) => {
      const friend = await friendService.acceptFriendRequest(
        requestId,
        userId,
      );
      return requestView(friend as FriendViewSource);
    },
  }),

  defineTool({
    name: "reject_friend_request",
    title: "Reject friend request",
    description: "Rejects an incoming friend request by its request id.",
    schema: {
      requestId: z.number().int().positive().describe("The request id"),
    },
    handler: async ({ requestId }, { userId }) => {
      await friendService.rejectFriendRequest(requestId, userId);
      return { success: true, requestId };
    },
  }),

  defineTool({
    name: "cancel_friend_request",
    title: "Cancel friend request",
    description: "Cancels a friend request the user previously sent.",
    schema: {
      requestId: z.number().int().positive().describe("The request id"),
    },
    handler: async ({ requestId }, { userId }) => {
      await friendService.cancelFriendRequest(requestId, userId);
      return { success: true, requestId };
    },
  }),

  defineTool({
    name: "remove_friend",
    title: "Remove friend",
    description: "Removes an accepted friendship by its friendship id.",
    schema: {
      friendshipId: z
        .number()
        .int()
        .positive()
        .describe("The friendship id"),
    },
    handler: async ({ friendshipId }, { userId }) => {
      await friendService.removeFriend(friendshipId, userId);
      return { success: true, friendshipId };
    },
  }),
];

export function findToolDefinition(name: string) {
  return toolDefinitions.find((tool) => tool.name === name);
}
