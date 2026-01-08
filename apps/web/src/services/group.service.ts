import { prisma } from "@/lib/prisma";
import { GroupPolicy } from "@/policies";

export class GroupService {
  /**
   * Create a new group with the user as the initial member
   */
  async createGroup(userId: string, name: string) {
    if (!name) {
      throw new Error("Group name is required");
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
    });

    return group;
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
    });

    return groups;
  }

  /**
   * Get a specific group by ID
   */
  async getGroupById(groupId: number, userId: string) {
    // Fetch the group ONLY if the user is a member (single query).
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
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
        invites: {
          where: {
            status: "pending",
          },
          include: {
            sender: true,
          },
        },
      },
    });

    if (!group) {
      // Either the group doesn't exist or the user isn't a member.
      throw new Error("Group not found or you are not a member of this group");
    }

    return group;
  }

  /**
   * Check if a user is a member of a group
   */
  async isUserMember(groupId: number, userId: string) {
    return GroupPolicy.isMember(userId, groupId);
  }

  /**
   * Search members in a group by name or email
   */
  async searchGroupMembers(groupId: number, userId: string, query: string) {
    // First verify the user is a member of the group
    const isMember = await this.isUserMember(groupId, userId);

    if (!isMember) {
      throw new Error("You are not a member of this group");
    }

    // Search for members whose name or email matches the query
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        user: {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: 10, // Limit results to 10
    });

    return members.map((member) => member.user);
  }
}

export const groupService = new GroupService();
