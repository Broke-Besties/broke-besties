import { prisma } from '@/lib/prisma'
import { RecurringPaymentPolicy } from '@/policies'
import { Prisma } from '@prisma/client'

type CreateRecurringPaymentParams = {
  amount: number
  description?: string | null
  frequency: number
  lenderId: string
  borrowers: Array<{ userId: string; splitPercentage: number }>
}

type UpdateRecurringPaymentParams = {
  amount?: number
  description?: string
  frequency?: number
  status?: string
}

type GetRecurringPaymentsFilters = {
  type?: 'lending' | 'borrowing' | null
  status?: 'active' | 'inactive' | null
}

export class RecurringPaymentService {
  /**
   * Create a new recurring payment
   */
  async createRecurringPayment(params: CreateRecurringPaymentParams) {
    const { amount, description, frequency, lenderId, borrowers } = params

    // Validation
    if (!amount || amount <= 0) {
      throw new Error('Valid amount is required')
    }

    if (!frequency || frequency < 1) {
      throw new Error('Frequency must be at least 1 day')
    }

    if (!borrowers || borrowers.length === 0) {
      throw new Error('At least one borrower is required')
    }

    // Validate percentages sum to 100%
    const totalPercentage = borrowers.reduce((sum, b) => sum + b.splitPercentage, 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('Split percentages must sum to 100%')
    }

    // Validate all percentages are positive
    if (borrowers.some(b => b.splitPercentage <= 0)) {
      throw new Error('All split percentages must be positive')
    }

    // Verify all borrowers exist
    for (const borrower of borrowers) {
      const user = await prisma.user.findUnique({
        where: { id: borrower.userId },
      })

      if (!user) {
        throw new Error(`Borrower with ID ${borrower.userId} not found`)
      }
    }

    // Check for duplicate borrowers
    const uniqueBorrowerIds = new Set(borrowers.map(b => b.userId))
    if (uniqueBorrowerIds.size !== borrowers.length) {
      throw new Error('Cannot add the same borrower multiple times')
    }

    // Create the recurring payment with borrowers in a transaction
    const recurringPayment = await prisma.$transaction(async (tx) => {
      const payment = await tx.recurringPayment.create({
        data: {
          amount,
          description: description || null,
          frequency,
          lenderId,
          status: 'active',
        },
      })

      await tx.recurringPaymentBorrower.createMany({
        data: borrowers.map(b => ({
          recurringPaymentId: payment.id,
          userId: b.userId,
          splitPercentage: b.splitPercentage,
        })),
      })

      // Fetch the complete payment with relations
      const completePayment = await tx.recurringPayment.findUnique({
        where: { id: payment.id },
        include: {
          lender: true,
          borrowers: {
            include: {
              user: true,
            },
          },
        },
      })

      if (!completePayment) {
        throw new Error('Failed to retrieve created recurring payment')
      }

      return completePayment
    })

    return recurringPayment
  }

  /**
   * Get all recurring payments for a user with optional filters
   */
  async getUserRecurringPayments(userId: string, filters: GetRecurringPaymentsFilters = {}) {
    const { type, status } = filters

    // Build the where clause
    const where: Prisma.RecurringPaymentWhereInput = {}

    // Apply type filter
    if (type === 'lending') {
      where.lenderId = userId
    } else if (type === 'borrowing') {
      where.borrowers = { some: { userId } }
    } else {
      // Show both lending and borrowing
      where.OR = [
        { lenderId: userId },
        { borrowers: { some: { userId } } },
      ]
    }

    // Apply status filter
    if (status) {
      where.status = status
    }

    const recurringPayments = await prisma.recurringPayment.findMany({
      where,
      include: {
        lender: true,
        borrowers: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return recurringPayments
  }

  /**
   * Get a specific recurring payment by ID
   */
  async getRecurringPaymentById(id: number, userId: string) {
    const recurringPayment = await prisma.recurringPayment.findUnique({
      where: { id },
      include: {
        lender: true,
        borrowers: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!recurringPayment) {
      throw new Error('Recurring payment not found')
    }

    // Check permission
    if (!await RecurringPaymentPolicy.canView(userId, id)) {
      throw new Error("You don't have permission to view this recurring payment")
    }

    return recurringPayment
  }

  /**
   * Update a recurring payment
   */
  async updateRecurringPayment(id: number, userId: string, updates: UpdateRecurringPaymentParams) {
    const { amount, description, frequency, status } = updates

    // Check permission (only lender can update)
    if (!await RecurringPaymentPolicy.canUpdate(userId, id)) {
      throw new Error("You don't have permission to update this recurring payment")
    }

    // Build update data
    const updateData: Prisma.RecurringPaymentUpdateInput = {}

    if (amount !== undefined) {
      if (amount <= 0) {
        throw new Error('Amount must be positive')
      }
      updateData.amount = amount
    }

    if (description !== undefined) {
      updateData.description = description
    }

    if (frequency !== undefined) {
      if (frequency < 1) {
        throw new Error('Frequency must be at least 1 day')
      }
      updateData.frequency = frequency
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        throw new Error('Status must be either "active" or "inactive"')
      }
      updateData.status = status
    }

    // Update the recurring payment
    const recurringPayment = await prisma.recurringPayment.update({
      where: { id },
      data: updateData,
      include: {
        lender: true,
        borrowers: {
          include: {
            user: true,
          },
        },
      },
    })

    return recurringPayment
  }

  /**
   * Delete a recurring payment (only lender can delete)
   */
  async deleteRecurringPayment(id: number, userId: string) {
    // Check if user can delete
    if (!await RecurringPaymentPolicy.canDelete(userId, id)) {
      throw new Error('Only the lender can delete this recurring payment')
    }

    await prisma.recurringPayment.delete({
      where: { id },
    })
  }

  /**
   * Toggle recurring payment status between active and inactive
   */
  async toggleStatus(id: number, userId: string) {
    // Check permission (only lender can toggle)
    if (!await RecurringPaymentPolicy.canUpdate(userId, id)) {
      throw new Error("You don't have permission to update this recurring payment")
    }

    // Get current status
    const payment = await prisma.recurringPayment.findUnique({
      where: { id },
      select: { status: true },
    })

    if (!payment) {
      throw new Error('Recurring payment not found')
    }

    // Toggle status
    const newStatus = payment.status === 'active' ? 'inactive' : 'active'

    // Update
    const updatedPayment = await prisma.recurringPayment.update({
      where: { id },
      data: { status: newStatus },
      include: {
        lender: true,
        borrowers: {
          include: {
            user: true,
          },
        },
      },
    })

    return updatedPayment
  }
}

export const recurringPaymentService = new RecurringPaymentService()
