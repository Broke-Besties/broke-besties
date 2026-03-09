'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
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

  if (!debt) return null

  const otherPerson = isLender ? debt.borrower : debt.lender

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full green-badge">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle>Mark as Paid</SheetTitle>
              <SheetDescription>
                Confirm this debt has been settled
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-muted-foreground">Amount</span>
              <span className="font-semibold font-mono tabular-nums text-lg">
                ${debt.amount.toFixed(2)}
              </span>
            </div>
            {debt.description && (
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-muted-foreground">Description</span>
                <span className="text-[13px]">{debt.description}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-muted-foreground">
                {isLender ? 'Borrower' : 'Lender'}
              </span>
              <span className="text-[13px]">{otherPerson.name || otherPerson.email}</span>
            </div>
          </div>

          <div className="yellow-callout">
            <p className="text-[13px]">
              This will send a request to <strong>{otherPerson.name || otherPerson.email}</strong> to confirm this payment has been settled.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Requesting...' : 'Request Confirmation'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
