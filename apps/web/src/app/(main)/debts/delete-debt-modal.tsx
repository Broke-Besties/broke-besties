'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { createDebtTransaction } from '@/app/groups/[id]/actions'

type DeleteDebtModalProps = {
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

export function DeleteDebtModal({ isOpen, onClose, onSuccess, debt, isLender }: DeleteDebtModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!debt) return

    setSubmitting(true)
    setError('')

    try {
      const result = await createDebtTransaction({
        debtId: debt.id,
        type: 'drop',
        reason: reason || undefined,
      })

      if (result.success) {
        onSuccess()
        handleClose()
      } else {
        setError(result.error || 'Failed to create deletion request')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setReason('')
    setError('')
    onClose()
  }

  if (!isOpen || !debt) return null

  const otherPerson = isLender ? debt.borrower : debt.lender

  return (
    <div className="fixed inset-0 z-50">
      <DialogOverlay onClick={handleClose} />
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full red-badge">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Delete Debt</DialogTitle>
              <DialogDescription>
                Request to remove this debt
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

          <div className="space-y-2">
            <Label htmlFor="deleteReason">Reason for deletion (optional)</Label>
            <Textarea
              id="deleteReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why should this debt be deleted?"
              className="resize-none"
            />
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This will send a request to <strong>{otherPerson.name || otherPerson.email}</strong> to approve the deletion.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Requesting...' : 'Request Deletion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  )
}
