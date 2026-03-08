'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { createConfirmPaidTransaction } from './actions'

type ConfirmPaidModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  debt: {
    id: number
    amount: number
    description: string | null
    borrower: { name: string; email: string }
    lender: { name: string; email: string }
  } | null
  isLender: boolean
}

export function ConfirmPaidModal({ isOpen, onClose, onSuccess, debt, isLender }: ConfirmPaidModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!debt) return

    setSubmitting(true)
    setError('')

    try {
      const result = await createConfirmPaidTransaction(debt.id)

      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error || 'Failed to create confirmation request')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !debt) return null

  const otherPerson = isLender ? debt.borrower : debt.lender

  return (
    <div className="fixed inset-0 z-50">
      <DialogOverlay onClick={onClose} />
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>
                Confirm this debt has been settled
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-semibold text-lg">${debt.amount.toFixed(2)}</span>
            </div>
            {debt.description && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Description</span>
                <span className="text-sm">{debt.description}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {isLender ? 'Borrower' : 'Lender'}
              </span>
              <span className="text-sm">{otherPerson.name || otherPerson.email}</span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This will send a request to <strong>{otherPerson.name || otherPerson.email}</strong> to confirm this payment has been settled.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Requesting...' : 'Request Confirmation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  )
}
