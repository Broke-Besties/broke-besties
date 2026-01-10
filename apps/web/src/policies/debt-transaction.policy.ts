import { Debt, DebtTransaction } from '@prisma/client'

type DebtWithParties = Pick<Debt, 'lenderId' | 'borrowerId'>
type TransactionWithDebt = DebtTransaction & { debt: DebtWithParties }

export class DebtTransactionPolicy {
  /**
   * Check if user can create a transaction for a debt
   */
  static canCreate(userId: string, debt: DebtWithParties): boolean {
    return debt.lenderId === userId || debt.borrowerId === userId
  }

  /**
   * Check if user can respond to a transaction
   */
  static canRespond(userId: string, transaction: TransactionWithDebt): boolean {
    const { debt } = transaction
    return debt.lenderId === userId || debt.borrowerId === userId
  }

  /**
   * Check if user can cancel a transaction
   */
  static canCancel(
    userId: string,
    transaction: Pick<DebtTransaction, 'requesterId' | 'status'>
  ): boolean {
    return (
      transaction.requesterId === userId && transaction.status === 'pending'
    )
  }

  /**
   * Check if user can view a transaction
   */
  static canView(userId: string, transaction: TransactionWithDebt): boolean {
    const { debt } = transaction
    return debt.lenderId === userId || debt.borrowerId === userId
  }

  /**
   * Check if user needs to approve (hasn't approved yet)
   */
  static needsApproval(
    userId: string,
    transaction: TransactionWithDebt
  ): boolean {
    if (transaction.status !== 'pending') return false

    const { debt } = transaction
    const isLender = debt.lenderId === userId
    const isBorrower = debt.borrowerId === userId

    if (isLender && !transaction.lenderApproved) return true
    if (isBorrower && !transaction.borrowerApproved) return true

    return false
  }

  /**
   * Get user's role and approval status for a transaction
   */
  static getUserStatus(
    userId: string,
    transaction: TransactionWithDebt
  ): {
    isLender: boolean
    isBorrower: boolean
    hasApproved: boolean
    needsToApprove: boolean
  } {
    const { debt } = transaction
    const isLender = debt.lenderId === userId
    const isBorrower = debt.borrowerId === userId

    let hasApproved = false
    if (isLender) hasApproved = transaction.lenderApproved
    if (isBorrower) hasApproved = transaction.borrowerApproved

    const needsToApprove =
      transaction.status === 'pending' && (isLender || isBorrower) && !hasApproved

    return { isLender, isBorrower, hasApproved, needsToApprove }
  }
}
