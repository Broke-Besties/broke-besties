'use client'

import { CheckCircle2, XCircle, Pencil, Trash2, X, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

type RequestDetailDialogProps = {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  currentUserId: string
  onApprove: (transaction: Transaction) => void
  onReject: (transaction: Transaction) => void
  responding: boolean
}

export function RequestDetailDialog({
  transaction,
  isOpen,
  onClose,
  currentUserId,
  onApprove,
  onReject,
  responding,
}: RequestDetailDialogProps) {
  if (!isOpen || !transaction) return null

  const isLender = transaction.debt.lenderId === currentUserId
  const isBorrower = transaction.debt.borrowerId === currentUserId
  const isRequester = transaction.requesterId === currentUserId
  const otherPerson = isLender ? transaction.debt.borrower : transaction.debt.lender

  const needsMyApproval = () => {
    if (isLender && !transaction.lenderApproved) return true
    if (isBorrower && !transaction.borrowerApproved) return true
    return false
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'confirm_paid':
        return <CheckCircle2 className="h-5 w-5" />
      case 'modify':
        return <Pencil className="h-5 w-5" />
      case 'drop':
        return <Trash2 className="h-5 w-5" />
      default:
        return <Clock className="h-5 w-5" />
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

  return (
    <>
      <DialogOverlay
        onClick={onClose}
        className="animate-in fade-in-0 duration-200"
      />
      <DialogContent className="max-w-md animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                getTypeBadgeClass(transaction.type)
              )}>
                {getTypeIcon(transaction.type)}
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {getTypeLabel(transaction.type)}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {isRequester ? 'You requested' : `Requested by ${transaction.requester.name || transaction.requester.email}`}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-md p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div className="space-y-4">
                {/* Current Debt Info */}
                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                  <Label className="text-muted-foreground text-xs">Current Debt</Label>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-semibold">${transaction.debt.amount.toFixed(2)}</span>
                  </div>
                  {transaction.debt.description && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Description</span>
                      <span className="text-sm">{transaction.debt.description}</span>
                    </div>
                  )}
                </div>

                {/* Proposed Changes */}
                {transaction.type === 'modify' && (transaction.proposedAmount || transaction.proposedDescription) && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <Label className="text-xs font-medium text-amber-700 dark:text-amber-300">Proposed Changes</Label>
                    {transaction.proposedAmount !== null && transaction.proposedAmount !== transaction.debt.amount && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">New Amount</span>
                        <span className="font-semibold">${transaction.proposedAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {transaction.proposedDescription && transaction.proposedDescription !== transaction.debt.description && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">New Description</span>
                        <span className="text-sm">{transaction.proposedDescription}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Reason */}
                {transaction.reason && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Reason</Label>
                    <p className="mt-1 text-sm">{transaction.reason}</p>
                  </div>
                )}

                {/* Other Person */}
                <div>
                  <Label className="text-muted-foreground text-xs">With</Label>
                  <p className="mt-1 text-sm">{otherPerson.name || otherPerson.email}</p>
                  {otherPerson.name && (
                    <p className="text-xs text-muted-foreground">{otherPerson.email}</p>
                  )}
                </div>

                {/* Group */}
                {transaction.debt.group && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Group</Label>
                    <p className="mt-1 text-sm">{transaction.debt.group.name}</p>
                  </div>
                )}

                {/* Created Date */}
                <div>
                  <Label className="text-muted-foreground text-xs">Requested</Label>
                  <p className="mt-1 text-sm">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Approval Status */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Approval Status</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {transaction.lenderApproved ? (
                        <CheckCircle2 className="h-4 w-4 text-green" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={cn(
                        "text-sm",
                        transaction.lenderApproved ? 'text-green' : 'text-muted-foreground'
                      )}>
                        Lender {transaction.lenderApproved ? 'approved' : 'pending'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {transaction.borrowerApproved ? (
                        <CheckCircle2 className="h-4 w-4 text-green" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={cn(
                        "text-sm",
                        transaction.borrowerApproved ? 'text-green' : 'text-muted-foreground'
                      )}>
                        Borrower {transaction.borrowerApproved ? 'approved' : 'pending'}
                      </span>
                    </div>
                  </div>
                </div>

            {/* Waiting message */}
            {!needsMyApproval() && isRequester && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <p className="text-sm text-muted-foreground text-center">
                  Waiting for {otherPerson.name || otherPerson.email} to respond
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {needsMyApproval() && (
              <div className="pt-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      onReject(transaction)
                      onClose()
                    }}
                    disabled={responding}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      onApprove(transaction)
                      onClose()
                    }}
                    disabled={responding}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </>
  )
}
