import { prisma } from "@/lib/prisma";
import { GroupInvite } from "@prisma/client";

export class InvitePolicy {
  /**
   * Check if user can create an invite for a group (any member can invite)
   */
  static async canCreate(userId: string, groupId: number): Promise<boolean> {
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
      },
    });
    return !!membership;
  }

  /**
   * Check if user can accept an invite (must be the invited person)
   * Pass the invite object to avoid duplicate database calls
   */
  static canAccept(
    userEmail: string,
    invite: Pick<GroupInvite, "invitedEmail" | "status">
  ): boolean {
    return invite.invitedEmail === userEmail && invite.status === "pending";
  }

  /**
   * Check if an invite already exists for this email in this group
   */
  static async inviteExists(
    groupId: number,
    invitedEmail: string
  ): Promise<boolean> {
    const invite = await prisma.groupInvite.findUnique({
      where: {
        groupId_invitedEmail: {
          groupId,
          invitedEmail,
        },
      },
    });
    return !!invite;
  }

  /**
   * Check if user is already a member of the group
   */
  static async isAlreadyMember(
    groupId: number,
    invitedEmail: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email: invitedEmail },
      include: {
        members: {
          where: { groupId },
        },
      },
    });

    return !!(user && user.members.length > 0);
  }

  /**
   * Check if user can cancel an invite (must be the sender and invite must be pending)
   */
  static canCancel(
    userId: string,
    invite: Pick<GroupInvite, "invitedBy" | "status">
  ): boolean {
    return invite.invitedBy === userId && invite.status === "pending";
  }

  /**
   * Check if user can reject an invite (must be the recipient and invite must be pending)
   */
  static canReject(
    userEmail: string,
    invite: Pick<GroupInvite, "invitedEmail" | "status">
  ): boolean {
    return invite.invitedEmail === userEmail && invite.status === "pending";
  }
}
