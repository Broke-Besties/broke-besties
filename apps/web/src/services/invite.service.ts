import { prisma } from '@/lib/prisma'

export class InviteService {
  /**
   * Create an invite to a group
   */
  async createInvite(userId: string, groupId: number, invitedEmail: string) {
    if (!groupId || !invitedEmail) {
      throw new Error('Group ID and invited email are required')
    }

    // Check if user is a member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    })

    if (!membership) {
      throw new Error('You are not a member of this group')
    }

    // Check if invite already exists
    const existingInvite = await prisma.groupInvite.findUnique({
      where: {
        groupId_invitedEmail: {
          groupId,
          invitedEmail,
        },
      },
    })

    if (existingInvite) {
      throw new Error('Invite already exists for this email')
    }

    // Check if user is already a member
    const existingMember = await prisma.user.findUnique({
      where: { email: invitedEmail },
      include: {
        members: {
          where: { groupId },
        },
      },
    })

    if (existingMember && existingMember.members.length > 0) {
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

    // Check if the invite is for the current user
    if (invite.invitedEmail !== userEmail) {
      throw new Error('This invite is not for you')
    }

    // Check if invite is still pending
    if (invite.status !== 'pending') {
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
}

export const inviteService = new InviteService()
