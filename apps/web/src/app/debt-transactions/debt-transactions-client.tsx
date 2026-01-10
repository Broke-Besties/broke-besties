'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  respondToDebtTransaction,
  cancelDebtTransaction,
} from '@/app/groups/[id]/actions'

type Transaction = {
  id: number
  debtId: number
  type: string
  status: string
  lenderApproved: boolean
  borrowerApproved: boolean
  proposedAmount: number | null
  proposedDescription: string | null
  reason: string | null
  createdAt: Date | string
  debt: {
    id: number
    amount: number
    description: string | null
    lender: {
      id: string
      email: string
      name: string
    }
    borrower: {
      id: string
      email: string
      name: string
    }
    group: {
      id: number
      name: string
    }
  }
  requester: {
    id: string
    email: string
    name: string
  }
}

type DebtTransactionsClientProps = {
  transactions: Transaction[]
  currentUserId: string
}

export default function DebtTransactionsClient({
  transactions,
  currentUserId,
}: DebtTransactionsClientProps) {
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const router = useRouter()

  const handleRespond = async (transactionId: number, approve: boolean) => {
    setProcessingId(transactionId)
    setError('')

    try {
      const result = await respondToDebtTransaction(transactionId, approve)

      if (!result.success) {
        setError(result.error || 'Failed to respond')
        setProcessingId(null)
        return
      }

      router.refresh()
    } catch (err) {
      setError('An error occurred')
      setProcessingId(null)
    } finally {
      setProcessingId(null)
    }
  }

  const handleCancel = async (transactionId: number) => {
    setProcessingId(transactionId)
    setError('')

    try {
      const result = await cancelDebtTransaction(transactionId)

      if (!result.success) {
        setError(result.error || 'Failed to cancel')
        setProcessingId(null)
        return
      }

      router.refresh()
    } catch (err) {
      setError('An error occurred')
      setProcessingId(null)
    } finally {
      setProcessingId(null)
    }
  }

  const getUserNeedsToApprove = (transaction: Transaction) => {
    const isLender = transaction.debt.lender.id === currentUserId
    const isBorrower = transaction.debt.borrower.id === currentUserId

    if (isLender && !transaction.lenderApproved) return true
    if (isBorrower && !transaction.borrowerApproved) return true
    return false
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          className="w-fit px-0"
          onClick={() => router.push('/dashboard')}
        >
          ← Back to dashboard
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Pending Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            You have {transactions.length} pending{' '}
            {transactions.length === 1 ? 'request' : 'requests'}.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No pending requests</CardTitle>
            <CardDescription>
              When someone requests to modify or delete a shared debt, it will
              show up here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')}>
              View my debts
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {transactions.map((transaction) => {
            const needsApproval = getUserNeedsToApprove(transaction)
            const isRequester = transaction.requester.id === currentUserId
            const isLender = transaction.debt.lender.id === currentUserId

            return (
              <Card key={transaction.id}>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {transaction.type === 'drop'
                        ? 'Delete Request'
                        : 'Modify Request'}
                    </CardTitle>
                    <CardDescription>
                      <Link
                        href={`/debts/${transaction.debt.id}`}
                        className="hover:underline"
                      >
                        ${transaction.debt.amount.toFixed(2)}
                      </Link>{' '}
                      - {isLender ? 'You lent to' : 'You borrowed from'}{' '}
                      <span className="font-medium text-foreground">
                        {isLender
                          ? transaction.debt.borrower.email
                          : transaction.debt.lender.email}
                      </span>
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  >
                    Pending
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Show proposed changes for modify type */}
                  {transaction.type === 'modify' && (
                    <div className="rounded-md border bg-muted/50 p-3 text-sm">
                      <div className="font-medium mb-2">Proposed changes:</div>
                      {transaction.proposedAmount !== null && (
                        <div>
                          Amount: ${transaction.debt.amount.toFixed(2)} → $
                          {transaction.proposedAmount.toFixed(2)}
                        </div>
                      )}
                      {transaction.proposedDescription !== null && (
                        <div>
                          Description:{' '}
                          {transaction.debt.description || '(none)'} →{' '}
                          {transaction.proposedDescription || '(none)'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reason */}
                  {transaction.reason && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Reason:</span>{' '}
                      {transaction.reason}
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div>
                      Requested by{' '}
                      <span className="font-medium text-foreground">
                        {isRequester ? 'you' : transaction.requester.email}
                      </span>
                    </div>
                    <div>
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      Group:{' '}
                      <span className="font-medium text-foreground">
                        {transaction.debt.group.name}
                      </span>
                    </div>
                  </div>

                  {/* Approval status */}
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Status:</span>{' '}
                    {transaction.lenderApproved
                      ? 'Lender approved'
                      : 'Lender pending'}
                    {' / '}
                    {transaction.borrowerApproved
                      ? 'Borrower approved'
                      : 'Borrower pending'}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {needsApproval && (
                      <>
                        <Button
                          onClick={() => handleRespond(transaction.id, true)}
                          disabled={processingId === transaction.id}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {processingId === transaction.id
                            ? 'Processing...'
                            : 'Approve'}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleRespond(transaction.id, false)}
                          disabled={processingId === transaction.id}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {isRequester && (
                      <Button
                        variant="secondary"
                        onClick={() => handleCancel(transaction.id)}
                        disabled={processingId === transaction.id}
                      >
                        Cancel Request
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() =>
                        router.push(`/debts/${transaction.debt.id}`)
                      }
                    >
                      View Debt
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
