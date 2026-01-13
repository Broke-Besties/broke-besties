import { prisma } from '@/lib/prisma'
import { DebtPolicy } from '@/policies'

type CreateDebtParams = {
  amount: number
  description?: string | null
  lenderId: string
  borrowerId: string
  groupId?: number | null
  receiptId?: string | null
}

type UpdateDebtParams = {
  amount?: number
  description?: string
  status?: string
}

type GetDebtsFilters = {
  type?: 'lending' | 'borrowing' | null
  groupId?: number | null
  status?: string | null
}

export class DebtService {
  /**
   * Create a new debt
   */
  async createDebt(params: CreateDebtParams) {
    const { amount, description, lenderId, borrowerId, groupId, receiptId } = params

    // Validation
    if (!amount || amount <= 0) {
      throw new Error('Valid amount is required')
    }

    if (!borrowerId) {
      throw new Error('Borrower ID is required')
    }

    // Prevent creating a debt to yourself
    if (borrowerId === lenderId) {
      throw new Error('Cannot create a debt to yourself')
    }

    // Verify borrower exists
    const borrower = await prisma.user.findUnique({
      where: { id: borrowerId },
    })

    if (!borrower) {
      throw new Error('Borrower not found')
    }

    // If groupId is provided, verify both users are members of the group
    if (groupId) {
      if (!await DebtPolicy.areBothGroupMembers(lenderId, borrowerId, groupId)) {
        throw new Error('Both lender and borrower must be group members')
      }
    }

    // Create the debt
    const debt = await prisma.debt.create({
      data: {
        amount,
        description: description || null,
        lenderId,
        borrowerId,
        groupId: groupId || null,
        status: 'pending',
        receiptId: receiptId || null,
      },
      include: {
        lender: {
          select: { id: true, email: true },
        },
        borrower: {
          select: { id: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    })

    return debt
  }

  /**
   * Get all debts for a user with optional filters
   */
  async getUserDebts(userId: string, filters: GetDebtsFilters = {}) {
    const { type, groupId, status } = filters

    // Build the where clause
    const where: any = {
      OR: [{ lenderId: userId }, { borrowerId: userId }],
    }

    // Apply filters
    if (type === 'lending') {
      where.OR = [{ lenderId: userId }]
    } else if (type === 'borrowing') {
      where.OR = [{ borrowerId: userId }]
    }

    if (groupId) {
      where.groupId = groupId
    }

    if (status) {
      where.status = status
    }

    const debts = await prisma.debt.findMany({
      where,
      include: {
        lender: {
          select: { id: true, email: true, name: true },
        },
        borrower: {
          select: { id: true, email: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return debts
  }

  /**
   * Get all debts for a group (user must be a member)
   */
  async getGroupDebts(groupId: number, userId: string) {
    // Verify user is a member of the group
    const membership = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: { userId, groupId },
      },
    })

    if (!membership) {
      throw new Error('You must be a member of the group to view its debts')
    }

    const debts = await prisma.debt.findMany({
      where: { groupId },
      include: {
        lender: {
          select: { id: true, name: true, email: true },
        },
        borrower: {
          select: { id: true, name: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return debts
  }

  /**
   * Get a specific debt by ID
   */
  async getDebtById(debtId: number, userId: string) {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: {
        lender: {
          select: { id: true, email: true },
        },
        borrower: {
          select: { id: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    })

    if (!debt) {
      throw new Error('Debt not found')
    }

    // Check permission using the fetched debt object
    if (!DebtPolicy.canView(userId, debt)) {
      throw new Error("You don't have permission to view this debt")
    }

    return debt
  }

  /**
   * Update a debt
   */
  async updateDebt(debtId: number, userId: string, updates: UpdateDebtParams) {
    const { amount, description, status } = updates

    // Check permission and get debt info (policy handles the fetch)
    const { canUpdate, isLender, debt: existingDebt } = await DebtPolicy.canUpdate(userId, debtId)

    if (!canUpdate || !existingDebt) {
      throw new Error("You don't have permission to update this debt")
    }

    // Build update data
    const updateData: any = {}

    // Only lender can update amount and description
    if (amount !== undefined || description !== undefined) {
      if (!isLender) {
        throw new Error('Only the lender can update amount and description')
      }
      if (amount !== undefined) {
        if (amount <= 0) {
          throw new Error('Amount must be positive')
        }
        updateData.amount = amount
      }
      if (description !== undefined) {
        updateData.description = description
      }
    }

    if (status !== undefined) {
      if (status !== 'pending') {
        throw new Error('Cannot set status to anything other than pending')
      }
      updateData.status = status
    }

    const debt = await prisma.debt.update({
      where: { id: debtId },
      data: updateData,
      include: {
        lender: {
          select: { id: true, email: true },
        },
        borrower: {
          select: { id: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    })

    return debt
  }

  /**
   * Delete a debt (only lender can delete)
   */
  async deleteDebt(debtId: number, userId: string) {
    // Check if user can delete (policy handles the fetch)
    if (!await DebtPolicy.canDelete(userId, debtId)) {
      throw new Error('Only the lender can delete this debt')
    }

    await prisma.debt.delete({
      where: { id: debtId },
    })
  }
}



export const debtService = new DebtService()
