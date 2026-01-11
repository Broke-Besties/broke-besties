import { prisma } from '@/lib/prisma'
import { InvitePolicy } from '@/policies'
import { friendService } from './friend.service'

export class InviteService {
  /**
   * Create an invite to a group
   */
  async createInvite(userId: string, groupId: number, invitedEmail: string) {
    if (!groupId || !invitedEmail) {
      throw new Error('Group ID and invited email are required')
    }

    // Check if user can create invites for this group
    if (!await InvitePolicy.canCreate(userId, groupId)) {
      throw new Error('You are not a member of this group')
    }

    // Check if invite already exists
    if (await InvitePolicy.inviteExists(groupId, invitedEmail)) {
      throw new Error('Invite already exists for this email')
    }

    // Check if user is already a member
    if (await InvitePolicy.isAlreadyMember(groupId, invitedEmail)) {
      throw new Error('User is already a member of this group')
    }

    // Create invite
    const invite = await prisma.groupInvite.create({
      data: {
        groupId,
        invitedBy: userId,
        invitedEmail,
      },
      include: {
        group: true,
        sender: true,
      },
    })

    return invite
  }

  /**
   * Add a friend directly to a group (no invite required)
   * The friend is added as a member immediately
   */
  async createInviteAsFriend(userId: string, groupId: number, friendUserId: string) {
    if (!groupId || !friendUserId) {
      throw new Error('Group ID and friend user ID are required')
    }

    // Check if user can create invites for this group
    if (!await InvitePolicy.canCreate(userId, groupId)) {
      throw new Error('You are not a member of this group')
    }

    // Verify they are actually friends
    const areFriends = await friendService.areFriends(userId, friendUserId)
    if (!areFriends) {
      throw new Error('You can only add friends directly to a group')
    }

    // Get the friend's user info
    const friendUser = await prisma.user.findUnique({
      where: { id: friendUserId },
    })

    if (!friendUser) {
      throw new Error('User not found')
    }

    // Check if friend is already a member
    if (await InvitePolicy.isAlreadyMember(groupId, friendUser.email)) {
      throw new Error('User is already a member of this group')
    }

    // Add friend directly to the group
    const member = await prisma.groupMember.create({
      data: {
        userId: friendUserId,
        groupId,
      },
      include: {
        user: true,
        group: true,
      },
    })

    return member
  }

  /**
   * Get pending invites for a user
   */
  async getUserInvites(userEmail: string) {
    const invites = await prisma.groupInvite.findMany({
      where: {
        invitedEmail: userEmail,
        status: 'pending',
      },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
        sender: true,
      },
    })

    return invites
  }

  /**
   * Accept an invite
   */
  async acceptInvite(userId: string, userEmail: string, inviteId: number) {
    // Get the invite
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
    })

    if (!invite) {
      throw new Error('Invite not found')
    }

    // Check if user can accept this invite
    if (!InvitePolicy.canAccept(userEmail, invite)) {
      if (invite.invitedEmail !== userEmail) {
        throw new Error('This invite is not for you')
      }
      throw new Error('This invite has already been processed')
    }

    // Add user to group and update invite status
    const [member] = await prisma.$transaction([
      prisma.groupMember.create({
        data: {
          userId,
          groupId: invite.groupId,
        },
        include: {
          group: true,
        },
      }),
      prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: 'accepted' },
      }),
    ])

    return member.group
  }

  /**
   * Cancel an invite (only the sender can cancel)
   */
  async cancelInvite(userId: string, inviteId: number) {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
    })

    if (!invite) {
      throw new Error('Invite not found')
    }

    if (!InvitePolicy.canCancel(userId, invite)) {
      throw new Error('You can only cancel invites you sent')
    }

    await prisma.groupInvite.delete({
      where: { id: inviteId },
    })

    return { success: true }
  }

  /**
   * Reject an invite (only the recipient can reject)
   */
  async rejectInvite(userEmail: string, inviteId: number) {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
    })

    if (!invite) {
      throw new Error('Invite not found')
    }

    if (!InvitePolicy.canReject(userEmail, invite)) {
      throw new Error('You can only reject invites sent to you')
    }

    await prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: 'rejected' },
    })

    return { success: true }
  }
}

export const inviteService = new InviteService()
