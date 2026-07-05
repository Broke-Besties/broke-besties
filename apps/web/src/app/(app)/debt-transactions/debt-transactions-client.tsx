'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Inbox } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  respondToDebtTransaction,
  cancelDebtTransaction,
} from '@/app/(app)/groups/[id]/actions'

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
    } | null
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
  const [processingId, setProcessingId] = useState<number | null>(null)
  const router = useRouter()

  const handleRespond = async (transactionId: number, approve: boolean) => {
    setProcessingId(transactionId)
    try {
      const result = await respondToDebtTransaction(transactionId, approve)
      if (!result.success) {
        toast.error(result.error || 'Failed to respond')
        return
      }
      router.refresh()
    } catch {
      toast.error('An error occurred')
    } finally {
      setProcessingId(null)
    }
  }

  const handleCancel = async (transactionId: number) => {
    setProcessingId(transactionId)
    try {
      const result = await cancelDebtTransaction(transactionId)
      if (!result.success) {
        toast.error(result.error || 'Failed to cancel')
        return
      }
      router.refresh()
    } catch {
      toast.error('An error occurred')
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit px-2"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft />
          Back to dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Pending requests
          </h1>
          <p className="text-sm text-muted-foreground">
            You have {transactions.length} pending{' '}
            {transactions.length === 1 ? 'request' : 'requests'}.
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No pending requests</EmptyTitle>
            <EmptyDescription>
              When someone requests to modify or delete a shared debt, it will
              show up here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => router.push('/dashboard')}>
              View my debts
            </Button>
          </EmptyContent>
        </Empty>
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
                    <CardTitle className="text-base">
                      {transaction.type === 'drop'
                        ? 'Delete request'
                        : 'Modify request'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      <Link
                        href={`/debts/${transaction.debt.id}`}
                        className="font-medium text-foreground tabular-nums hover:underline"
                      >
                        ${transaction.debt.amount.toFixed(2)}
                      </Link>{' '}
                      · {isLender ? 'You lent to' : 'You borrowed from'}{' '}
                      <span className="font-medium text-foreground">
                        {isLender
                          ? transaction.debt.borrower.email
                          : transaction.debt.lender.email}
                      </span>
                    </p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {transaction.type === 'modify' && (
                    <div className="rounded-md border bg-muted/50 p-3 text-sm">
                      <div className="mb-2 font-medium">Proposed changes</div>
                      {transaction.proposedAmount !== null && (
                        <div className="tabular-nums">
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

                  {transaction.reason && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Reason:</span>{' '}
                      {transaction.reason}
                    </div>
                  )}

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
                    {transaction.debt.group?.name && (
                      <div>
                        Group:{' '}
                        <span className="font-medium text-foreground">
                          {transaction.debt.group.name}
                        </span>
                      </div>
                    )}
                  </div>

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

                  <div className="flex flex-wrap gap-2">
                    {needsApproval && (
                      <>
                        <Button
                          onClick={() => handleRespond(transaction.id, true)}
                          disabled={processingId === transaction.id}
                        >
                          {processingId === transaction.id
                            ? 'Processing…'
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
                        Cancel request
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() =>
                        router.push(`/debts/${transaction.debt.id}`)
                      }
                    >
                      View debt
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
