import { prisma } from '@/lib/prisma'

type CreateDebtParams = {
  amount: number
  description?: string | null
  lenderId: string
  borrowerId: string
  groupId: number
}

type UpdateDebtParams = {
  amount?: number
  description?: string
  status?: string
}

type GetDebtsFilters = {
  type?: 'lending' | 'borrowing' | null
  groupId?: string | null
  status?: string | null
}

export class DebtService {
  /**
   * Create a new debt
   */
  async createDebt(params: CreateDebtParams) {
    const { amount, description, lenderId, borrowerId, groupId } = params

    // Validation
    if (!amount || amount <= 0) {
      throw new Error('Valid amount is required')
    }

    if (!borrowerId) {
      throw new Error('Borrower ID is required')
    }

    if (!groupId) {
      throw new Error('Group ID is required')
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

    // Verify the group exists and both users are members
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          select: { userId: true },
        },
      },
    })

    if (!group) {
      throw new Error('Group not found')
    }

    const memberIds = group.members.map((m) => m.userId)
    if (!memberIds.includes(lenderId) || !memberIds.includes(borrowerId)) {
      throw new Error('Both lender and borrower must be group members')
    }

    // Create the debt
    const debt = await prisma.debt.create({
      data: {
        amount,
        description: description || null,
        lenderId,
        borrowerId,
        groupId,
        status: 'pending',
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
          select: { id: true, email: true },
        },
        borrower: {
          select: { id: true, email: true },
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

    // Verify user is either lender or borrower
    if (debt.lenderId !== userId && debt.borrowerId !== userId) {
      throw new Error("You don't have permission to view this debt")
    }

    return debt
  }

  /**
   * Update a debt
   */
  async updateDebt(debtId: number, userId: string, updates: UpdateDebtParams) {
    const { amount, description, status } = updates

    // Fetch existing debt
    const existingDebt = await prisma.debt.findUnique({
      where: { id: debtId },
    })

    if (!existingDebt) {
      throw new Error('Debt not found')
    }

    // Verify user is either lender or borrower
    const isLender = existingDebt.lenderId === userId
    const isBorrower = existingDebt.borrowerId === userId

    if (!isLender && !isBorrower) {
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

    // Both lender and borrower can update status
    if (status !== undefined) {
      updateData.status = status
    }

    // Update the debt
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
    // Fetch existing debt
    const existingDebt = await prisma.debt.findUnique({
      where: { id: debtId },
    })

    if (!existingDebt) {
      throw new Error('Debt not found')
    }

    // Only lender can delete the debt
    if (existingDebt.lenderId !== userId) {
      throw new Error('Only the lender can delete this debt')
    }

    await prisma.debt.delete({
      where: { id: debtId },
    })
  }
}

export const debtService = new DebtService()
