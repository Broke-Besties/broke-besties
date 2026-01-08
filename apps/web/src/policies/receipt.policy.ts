import { prisma } from '@/lib/prisma'
import { Receipt } from '@prisma/client'

export class ReceiptPolicy {
  /**
   * Check if user can view a receipt (must be group member)
   * Pass the receipt object with group members to avoid duplicate database calls
   * Use this for GET operations when you already have the receipt data
   */
  static canView(
    userId: string,
    receipt: { group: { members: Array<{ userId: string }> } }
  ): boolean {
    return receipt.group.members.some((m) => m.userId === userId)
  }

  /**
   * Check if user can create/upload a receipt (must be group member)
   * Makes DB call for CREATE operation before uploading
   */
  static async canCreate(userId: string, groupId: number): Promise<boolean> {
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
      },
    })
    return !!membership
  }

  /**
   * Check if user can delete a receipt (must be group member)
   * Pass the receipt object to avoid duplicate database calls
   * Any group member can delete receipts
   */
  static canDelete(
    userId: string,
    receipt: { group: { members: Array<{ userId: string }> } }
  ): boolean {
    return this.canView(userId, receipt)
  }

  /**
   * Check if user can access receipts for a group (must be group member)
   * Makes DB call for LIST operation
   */
  static async canListGroupReceipts(userId: string, groupId: number): Promise<boolean> {
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
      },
    })
    return !!membership
  }
}
