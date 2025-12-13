import { prisma } from '@/lib/prisma'

export class GroupService {
  /**
   * Create a new group with the user as the initial member
   */
  async createGroup(userId: string, name: string) {
    if (!name) {
      throw new Error('Group name is required')
    }

    const group = await prisma.group.create({
      data: {
        name,
        members: {
          create: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    })

    return group
  }

  /**
   * Get all groups for a user
   */
  async getUserGroups(userId: string) {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    })

    return groups
  }

  /**
   * Get a specific group by ID
   */
  async getGroupById(groupId: number, userId: string) {
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

    // Get group details with members and invites
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        invites: {
          where: {
            status: 'pending',
          },
          include: {
            sender: true,
          },
        },
      },
    })

    if (!group) {
      throw new Error('Group not found')
    }

    return group
  }

  /**
   * Check if a user is a member of a group
   */
  async isUserMember(groupId: number, userId: string) {
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    })

    return !!membership
  }
}

export const groupService = new GroupService()
