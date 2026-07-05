import { prisma } from "@/lib/prisma";
import type { NavCounts } from "@/lib/nav";

/**
 * Counts surfaced as sidebar badges: debt requests awaiting the user's
 * approval, pending group invites, and incoming friend requests.
 */
export async function getNavCounts(
  userId: string,
  email: string,
): Promise<NavCounts> {
  const [debtRequests, invites, friendRequests] = await Promise.all([
    prisma.debtTransaction.count({
      where: {
        status: "pending",
        OR: [
          { debt: { lenderId: userId }, lenderApproved: false },
          { debt: { borrowerId: userId }, borrowerApproved: false },
        ],
      },
    }),
    prisma.groupInvite.count({
      where: { invitedEmail: email, status: "pending" },
    }),
    prisma.friend.count({
      where: { recipientId: userId, status: "pending" },
    }),
  ]);

  return { debtRequests, invites, friendRequests };
}
