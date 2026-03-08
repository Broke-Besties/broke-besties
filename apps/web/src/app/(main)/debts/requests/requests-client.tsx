'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Pencil, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { respondToTransaction } from '../actions'

type Transaction = {
  id: number
  debtId: number
  type: string
  status: string
  requesterId: string
  lenderApproved: boolean
  borrowerApproved: boolean
  proposedAmount: number | null
  proposedDescription: string | null
  reason: string | null
  createdAt: string | Date
  debt: {
    id: number
    amount: number
    description: string | null
    lenderId: string
    borrowerId: string
    lender: { id: string; name: string; email: string }
    borrower: { id: string; name: string; email: string }
    group: { id: number; name: string } | null
  }
  requester: { id: string; name: string; email: string }
}

type RequestsPageClientProps = {
  initialTransactions: Transaction[]
  currentUserId: string
}

export default function RequestsPageClient({
  initialTransactions,
  currentUserId,
}: RequestsPageClientProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [responding, setResponding] = useState<number | null>(null)
  const router = useRouter()

  const handleRespond = async (transactionId: number, approve: boolean) => {
    setResponding(transactionId)
    const result = await respondToTransaction(transactionId, approve)
    if (result.success) {
      // Remove the transaction from the list
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      router.refresh()
    }
    setResponding(null)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'confirm_paid':
        return <CheckCircle2 className="h-4 w-4" />
      case 'modify':
        return <Pencil className="h-4 w-4" />
      case 'drop':
        return <Trash2 className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'confirm_paid':
        return 'Payment Confirmation'
      case 'modify':
        return 'Modification Request'
      case 'drop':
        return 'Deletion Request'
      default:
        return type
    }
  }

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'confirm_paid':
        return 'green-badge'
      case 'modify':
        return 'yellow-badge'
      case 'drop':
        return 'red-badge'
      default:
        return ''
    }
  }

  const needsMyApproval = (transaction: Transaction) => {
    const isLender = transaction.debt.lenderId === currentUserId
    const isBorrower = transaction.debt.borrowerId === currentUserId

    if (isLender && !transaction.lenderApproved) return true
    if (isBorrower && !transaction.borrowerApproved) return true
    return false
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/debts">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Pending Requests</h1>
          <p className="text-sm text-muted-foreground">
            Review and respond to pending debt requests
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No pending requests</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re all caught up!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const isLender = transaction.debt.lenderId === currentUserId
            const otherPerson = isLender ? transaction.debt.borrower : transaction.debt.lender
            const isRequester = transaction.requesterId === currentUserId
            const needsApproval = needsMyApproval(transaction)

            return (
              <Card key={transaction.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        getTypeBadgeClass(transaction.type)
                      )}>
                        {getTypeIcon(transaction.type)}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {getTypeLabel(transaction.type)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {isRequester ? 'You requested' : `Requested by ${transaction.requester.name || transaction.requester.email}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="yellow-badge">
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Debt Details */}
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Amount</span>
                      <span className="font-semibold">${transaction.debt.amount.toFixed(2)}</span>
                    </div>
                    {transaction.debt.description && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Description</span>
                        <span className="text-sm">{transaction.debt.description}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">With</span>
                      <span className="text-sm">{otherPerson.name || otherPerson.email}</span>
                    </div>
                    {transaction.debt.group && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Group</span>
                        <span className="text-sm">{transaction.debt.group.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Proposed Changes (for modify type) */}
                  {transaction.type === 'modify' && (transaction.proposedAmount || transaction.proposedDescription) && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Proposed Changes:</p>
                      {transaction.proposedAmount && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">New Amount</span>
                          <span className="font-semibold">${transaction.proposedAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {transaction.proposedDescription && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">New Description</span>
                          <span className="text-sm">{transaction.proposedDescription}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reason */}
                  {transaction.reason && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reason: </span>
                      <span>{transaction.reason}</span>
                    </div>
                  )}

                  {/* Approval Status */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {transaction.lenderApproved ? (
                        <CheckCircle2 className="h-4 w-4 text-green" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={transaction.lenderApproved ? 'text-green' : 'text-muted-foreground'}>
                        Lender {transaction.lenderApproved ? 'approved' : 'pending'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {transaction.borrowerApproved ? (
                        <CheckCircle2 className="h-4 w-4 text-green" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={transaction.borrowerApproved ? 'text-green' : 'text-muted-foreground'}>
                        Borrower {transaction.borrowerApproved ? 'approved' : 'pending'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {needsApproval && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleRespond(transaction.id, false)}
                        disabled={responding === transaction.id}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => handleRespond(transaction.id, true)}
                        disabled={responding === transaction.id}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </div>
                  )}

                  {!needsApproval && isRequester && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Waiting for {otherPerson.name || otherPerson.email} to respond
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
