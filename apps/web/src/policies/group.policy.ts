import { prisma } from '@/lib/prisma'
import { Group, GroupMember } from '@prisma/client'

export class GroupPolicy {
  /**
   * Check if user is a member using a group object with members included
   * Use this for GET operations when you already have the group data
   */
  static canView(
    userId: string,
    group: { members: Array<{ userId: string }> }
  ): boolean {
    return group.members.some((member) => member.userId === userId)
  }

  /**
   * Check if user can create a group (any authenticated user can)
   * No DB call needed - just check if userId exists
   */
  static canCreate(userId: string): boolean {
    return !!userId
  }

  /**
   * Check if user is a member of a group
   * Use this for basic membership checks
   */
  static async isMember(userId: string, groupId: number): Promise<boolean> {
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
      },
    })
    return !!membership
  }

  /**
   * Check if user can invite others to a group (must be member)
   * Makes DB call for CREATE operation
   */
  static async canInvite(userId: string, groupId: number): Promise<boolean> {
    return this.isMember(userId, groupId)
  }

  /**
   * Check if user can update a group (must be member)
   * Makes DB call for UPDATE operation
   */
  static async canUpdate(userId: string, groupId: number): Promise<boolean> {
    return this.isMember(userId, groupId)
  }

  /**
   * Check if user can delete a group (must be member)
   * Makes DB call for DELETE operation
   */
  static async canDelete(userId: string, groupId: number): Promise<boolean> {
    return this.isMember(userId, groupId)
  }
}
