import { prisma } from '@/lib/prisma'
import { InvitePolicy } from '@/policies'
import { emailService } from './email.service'

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

    // Send email notification
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invites`
    await emailService.sendGroupInvite({
      to: invitedEmail,
      inviterName: invite.sender.name,
      groupName: invite.group.name,
      inviteLink,
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

    // Check if user can accept this invite
    if (!InvitePolicy.canAccept(userEmail, invite)) {
      if (invite.invitedEmail !== userEmail) {
        throw new Error('This invite is not for you')
      }
      throw new Error('This invite has already been processed')
    }

    // Add user to group and update invite status
    const [member, updatedInvite] = await prisma.$transaction([
      prisma.groupMember.create({
        data: {
          userId,
          groupId: invite.groupId,
        },
        include: {
          group: true,
          user: true,
        },
      }),
      prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: 'accepted' },
        include: {
          sender: true,
        },
      }),
    ])

    // Send confirmation email to the person who sent the invite
    const groupLink = `${process.env.NEXT_PUBLIC_APP_URL}/groups/${member.group.id}`
    await emailService.sendInviteAccepted({
      to: updatedInvite.sender.email,
      accepterName: member.user.name,
      groupName: member.group.name,
      groupLink,
    })

    return member.group
  }
}

export const inviteService = new InviteService()
