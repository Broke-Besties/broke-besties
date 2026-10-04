import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase'
import { User } from '@prisma/client'

export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return user
  }

  /**
   * Search for a user by email
   */
  async searchUserByEmail(email: string) {
    if (!email) {
      throw new Error('Email parameter is required')
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return user
  }
  async updateUser(userId: string, data: Partial<User>) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    })

    return user
  }

  /**
   * Delete an account (App Store 5.1.1(v)). The User row is anonymized, not deleted:
   * every relation cascades on delete, which would also wipe the other person's
   * debts, transactions and alerts. Safe to retry.
   */
  async deleteAccount(userId: string) {
    // Built first so a misconfigured env fails before anything changes
    const supabase = createAdminClient()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    let receiptIds: string[] = []
    if (user) {
      receiptIds = await prisma.$transaction(async (tx) => {
        // Before the email changes: GroupInvite.invitedEmail follows User.email
        // (ON UPDATE CASCADE)
        await tx.groupInvite.deleteMany({ where: { invitedEmail: user.email } })
        await tx.groupInvite.deleteMany({
          where: { invitedBy: userId, status: 'pending' },
        })
        // Accepted friendships too, or friends could still add "Deleted user" to
        // groups and create debts against it
        await tx.friend.deleteMany({
          where: { OR: [{ requesterId: userId }, { recipientId: userId }] },
        })
        await tx.groupMember.deleteMany({ where: { userId } })
        await tx.tab.deleteMany({ where: { userId } })
        await tx.alert.updateMany({
          where: { OR: [{ lenderId: userId }, { borrowerId: userId }] },
          data: { isActive: false },
        })
        await tx.debtTransaction.updateMany({
          where: { requesterId: userId, status: 'pending' },
          data: { status: 'cancelled', resolvedAt: new Date() },
        })
        await tx.recurringPayment.updateMany({
          where: { lenderId: userId },
          data: { status: 'inactive' },
        })
        await tx.paypalAccount.deleteMany({ where: { userId } })

        const receipts = await tx.receipt.findMany({
          where: { uploaderId: userId, debts: { none: {} } },
          select: { id: true },
        })
        const ids = receipts.map((receipt) => receipt.id)
        await tx.receipt.deleteMany({ where: { id: { in: ids } } })

        await tx.user.update({
          where: { id: userId },
          data: {
            name: 'Deleted user',
            email: `deleted+${userId}@users.brokebesties.invalid`,
          },
        })
        return ids
      })
    }

    if (receiptIds.length > 0) {
      // ponytail: best effort, a failed removal orphans those images; sweep receipts/
      // for objects without a Receipt row if that ever matters
      const { error } = await supabase.storage
        .from('receipts')
        .remove(receiptIds.map((id) => `receipts/${id}`))
        .catch((error) => ({ error }))
      if (error) {
        console.error('Failed to remove receipt images of a deleted account:', error)
      }
    }

    // 404: an earlier attempt already deleted the auth user
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error && error.status !== 404) {
      throw error
    }
  }
}

export const userService = new UserService()
