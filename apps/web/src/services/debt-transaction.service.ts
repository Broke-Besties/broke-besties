import { prisma } from '@/lib/prisma'
import { emailService } from './email.service'

type CreateTransactionParams = {
  debtId: number
  type: 'drop' | 'modify' | 'confirm_paid'
  requesterId: string
  proposedAmount?: number
  proposedDescription?: string
  reason?: string
}

type RespondToTransactionParams = {
  transactionId: number
  userId: string
  approve: boolean
}

const userSelect = { id: true, email: true, name: true }
const debtInclude = {
  lender: { select: userSelect },
  borrower: { select: userSelect },
  group: { select: { id: true, name: true } },
}

export class DebtTransactionService {
  /**
   * Create a new debt transaction request
   */
  async createTransaction(params: CreateTransactionParams) {
    const {
      debtId,
      type,
      requesterId,
      proposedAmount,
      proposedDescription,
      reason,
    } = params

    // Validate the debt exists and get its details
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: { lender: true, borrower: true },
    })

    if (!debt) {
      throw new Error('Debt not found')
    }

    // Validate requester is either lender or borrower
    const isLender = debt.lenderId === requesterId
    const isBorrower = debt.borrowerId === requesterId

    if (!isLender && !isBorrower) {
      throw new Error(
        'You are not authorized to create a transaction for this debt'
      )
    }

    // Validate type-specific requirements
    if (type === 'modify') {
      if (proposedAmount === undefined && proposedDescription === undefined) {
        throw new Error(
          'Modification must include at least one change (amount or description)'
        )
      }
      if (proposedAmount !== undefined && proposedAmount <= 0) {
        throw new Error('Proposed amount must be positive')
      }
    }

    // Check for existing pending transactions on this debt
    const existingPending = await prisma.debtTransaction.findFirst({
      where: {
        debtId,
        status: 'pending',
      },
    })

    if (existingPending) {
      throw new Error('There is already a pending transaction for this debt')
    }

    // Create the transaction with auto-approval for requester
    const transaction = await prisma.debtTransaction.create({
      data: {
        debtId,
        type,
        requesterId,
        proposedAmount: type === 'modify' ? proposedAmount : null,
        proposedDescription: type === 'modify' ? proposedDescription : null,
        reason,
        // Auto-approve for the requester
        lenderApproved: isLender,
        borrowerApproved: isBorrower,
      },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    })

    // Send email notification to the other party
    try {
      // Determine recipient (the party who didn't make the request)
      const recipient = isLender ? transaction.debt.borrower : transaction.debt.lender
      const requesterName = transaction.requester.name || transaction.requester.email
      const recipientName = recipient.name || recipient.email

      // Build debt link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const debtLink = `${baseUrl}/debts/${debtId}`

      // Send email for drop or modify transactions only (not confirm_paid)
      if (type === 'drop' || type === 'modify') {
        await emailService.sendDebtModificationRequest({
          to: recipient.email,
          recipientName,
          requesterName,
          type,
          currentAmount: transaction.debt.amount,
          currentDescription: transaction.debt.description || 'No description',
          proposedAmount: transaction.proposedAmount ?? undefined,
          proposedDescription: transaction.proposedDescription ?? undefined,
          reason: transaction.reason ?? undefined,
          groupName: transaction.debt.group?.name,
          debtLink,
        })
      }
    } catch (emailError) {
      // Log error but don't fail the transaction creation
      console.error('Failed to send debt modification request email:', emailError)
    }

    return transaction
  }

  /**
   * Respond to a debt transaction (approve or reject)
   */
  async respondToTransaction(params: RespondToTransactionParams) {
    const { transactionId, userId, approve } = params

    const transaction = await prisma.debtTransaction.findUnique({
      where: { id: transactionId },
      include: {
        debt: true,
      },
    })

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    if (transaction.status !== 'pending') {
      throw new Error('This transaction has already been processed')
    }

    const isLender = transaction.debt.lenderId === userId
    const isBorrower = transaction.debt.borrowerId === userId

    if (!isLender && !isBorrower) {
      throw new Error('You are not authorized to respond to this transaction')
    }

    // If rejecting, update status and return
    if (!approve) {
      const updated = await prisma.debtTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'rejected',
          resolvedAt: new Date(),
        },
        include: {
          debt: { include: debtInclude },
          requester: { select: userSelect },
        },
      })

      // Send rejection email to requester
      try {
        const rejector = isLender ? updated.debt.lender : updated.debt.borrower
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const debtLink = `${baseUrl}/debts/${updated.debtId}`

        // Only send for drop/modify, not confirm_paid
        if (updated.type === 'drop' || updated.type === 'modify') {
          await emailService.sendDebtRequestRejected({
            to: updated.requester.email,
            requesterName: updated.requester.name || updated.requester.email,
            rejectorName: rejector.name || rejector.email,
            type: updated.type as 'drop' | 'modify',
            amount: updated.debt.amount,
            description: updated.debt.description || 'No description',
            proposedAmount: updated.proposedAmount ?? undefined,
            proposedDescription: updated.proposedDescription ?? undefined,
            groupName: updated.debt.group?.name,
            debtLink,
          })
        }
      } catch (emailError) {
        console.error('Failed to send debt request rejected email:', emailError)
      }

      return { transaction: updated, debtUpdated: false }
    }

    // Approving: update the appropriate approval field
    const updateData: { lenderApproved?: boolean; borrowerApproved?: boolean } =
      {}
    if (isLender) {
      updateData.lenderApproved = true
    }
    if (isBorrower) {
      updateData.borrowerApproved = true
    }

    // Check if both will now be approved
    const willBothApprove =
      (updateData.lenderApproved || transaction.lenderApproved) &&
      (updateData.borrowerApproved || transaction.borrowerApproved)

    if (willBothApprove) {
      // Execute the transaction using a database transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update transaction status
        const updatedTransaction = await tx.debtTransaction.update({
          where: { id: transactionId },
          data: {
            ...updateData,
            status: 'approved',
            resolvedAt: new Date(),
          },
          include: {
            debt: { include: debtInclude },
            requester: { select: userSelect },
          },
        })

        // Apply the change to the debt
        if (transaction.type === 'drop') {
          // Get debt with alert before deleting
          const debtToDelete = await tx.debt.findUnique({
            where: { id: transaction.debtId },
            select: { alertId: true },
          })
          
          // Deactivate associated alert if it exists
          if (debtToDelete?.alertId) {
            await tx.alert.update({
              where: { id: debtToDelete.alertId },
              data: { isActive: false },
            })
          }
          
          await tx.debt.delete({
            where: { id: transaction.debtId },
          })
        } else if (transaction.type === 'modify') {
          const debtUpdate: { amount?: number; description?: string | null } =
            {}
          if (transaction.proposedAmount !== null) {
            debtUpdate.amount = transaction.proposedAmount
          }
          if (transaction.proposedDescription !== null) {
            debtUpdate.description = transaction.proposedDescription
          }
          await tx.debt.update({
            where: { id: transaction.debtId },
            data: debtUpdate,
          })
        } else if (transaction.type === 'confirm_paid') {
          // Mark the debt as paid
          const updatedDebt = await tx.debt.update({
            where: { id: transaction.debtId },
            data: { status: 'paid' },
            include: { alert: true },
          })
          
          // Deactivate associated alert if it exists
          if (updatedDebt.alertId) {
            await tx.alert.update({
              where: { id: updatedDebt.alertId },
              data: { isActive: false },
            })
          }
        }

        return updatedTransaction
      })

      // Send approval email to requester
      try {
        const approver = isLender ? result.debt.lender : result.debt.borrower
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const debtLink =
          result.type === 'drop'
            ? `${baseUrl}/dashboard`
            : `${baseUrl}/debts/${result.debtId}`

        // Only send for drop/modify, not confirm_paid
        if (result.type === 'drop' || result.type === 'modify') {
          await emailService.sendDebtRequestApproved({
            to: result.requester.email,
            requesterName: result.requester.name || result.requester.email,
            approverName: approver.name || approver.email,
            type: result.type as 'drop' | 'modify',
            amount: result.debt.amount,
            description: result.debt.description || 'No description',
            proposedAmount: result.proposedAmount ?? undefined,
            proposedDescription: result.proposedDescription ?? undefined,
            groupName: result.debt.group?.name,
            debtLink,
          })
        }
      } catch (emailError) {
        console.error('Failed to send debt request approved email:', emailError)
      }

      return { transaction: result, debtUpdated: true }
    }

    // Only one party approved, just update the approval
    const updated = await prisma.debtTransaction.update({
      where: { id: transactionId },
      data: updateData,
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    })

    return { transaction: updated, debtUpdated: false }
  }

  /**
   * Cancel a pending transaction (only requester can cancel)
   */
  async cancelTransaction(transactionId: number, userId: string) {
    const transaction = await prisma.debtTransaction.findUnique({
      where: { id: transactionId },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    })

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    if (transaction.requesterId !== userId) {
      throw new Error('Only the requester can cancel this transaction')
    }

    if (transaction.status !== 'pending') {
      throw new Error('This transaction has already been processed')
    }

    const cancelled = await prisma.debtTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'cancelled',
        resolvedAt: new Date(),
      },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    })

    // Send cancellation email to the other party
    try {
      // Determine the other party (who is not the requester)
      const isRequesterLender = cancelled.debt.lenderId === userId
      const otherParty = isRequesterLender
        ? cancelled.debt.borrower
        : cancelled.debt.lender
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const debtLink = `${baseUrl}/debts/${cancelled.debtId}`

      // Only send for drop/modify, not confirm_paid
      if (cancelled.type === 'drop' || cancelled.type === 'modify') {
        await emailService.sendDebtRequestCancelled({
          to: otherParty.email,
          recipientName: otherParty.name || otherParty.email,
          requesterName: cancelled.requester.name || cancelled.requester.email,
          type: cancelled.type as 'drop' | 'modify',
          amount: cancelled.debt.amount,
          description: cancelled.debt.description || 'No description',
          proposedAmount: cancelled.proposedAmount ?? undefined,
          proposedDescription: cancelled.proposedDescription ?? undefined,
          groupName: cancelled.debt.group?.name,
          debtLink,
        })
      }
    } catch (emailError) {
      console.error('Failed to send debt request cancelled email:', emailError)
    }

    return cancelled
  }

  /**
   * Get pending transactions for a user (either as participant or requester)
   */
  async getUserPendingTransactions(userId: string) {
    return prisma.debtTransaction.findMany({
      where: {
        status: 'pending',
        debt: {
          OR: [{ lenderId: userId }, { borrowerId: userId }],
        },
      },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get transactions for a specific debt
   */
  async getDebtTransactions(debtId: number, userId: string) {
    // Verify user has access to the debt
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
    })

    if (!debt) {
      throw new Error('Debt not found')
    }

    if (debt.lenderId !== userId && debt.borrowerId !== userId) {
      throw new Error('You do not have access to this debt')
    }

    return prisma.debtTransaction.findMany({
      where: { debtId },
      include: {
        requester: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get a single transaction by ID
   */
  async getTransactionById(transactionId: number, userId: string) {
    const transaction = await prisma.debtTransaction.findUnique({
      where: { id: transactionId },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    })

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    // Verify access
    if (
      transaction.debt.lenderId !== userId &&
      transaction.debt.borrowerId !== userId
    ) {
      throw new Error('You do not have access to this transaction')
    }

    return transaction
  }

  /**
   * Get count of pending transactions that need user's approval
   */
  async getPendingCountForUser(userId: string) {
    const transactions = await prisma.debtTransaction.findMany({
      where: {
        status: 'pending',
        debt: {
          OR: [{ lenderId: userId }, { borrowerId: userId }],
        },
      },
      include: {
        debt: {
          select: { lenderId: true, borrowerId: true },
        },
      },
    })

    // Count only transactions where the user hasn't approved yet
    return transactions.filter((t) => {
      const isLender = t.debt.lenderId === userId
      const isBorrower = t.debt.borrowerId === userId

      if (isLender && !t.lenderApproved) return true
      if (isBorrower && !t.borrowerApproved) return true
      return false
    }).length
  }
}

export const debtTransactionService = new DebtTransactionService()
