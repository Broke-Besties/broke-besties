'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { createDebtTransaction } from '@/app/groups/[id]/actions'

type ModifyDebtModalProps = {
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

export function ModifyDebtModal({ isOpen, onClose, onSuccess, debt, isLender }: ModifyDebtModalProps) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleOpen = () => {
    if (debt) {
      setAmount(debt.amount.toString())
      setDescription(debt.description || '')
    }
  }

  const handleConfirm = async () => {
    if (!debt) return

    const newAmount = parseFloat(amount)
    const hasAmountChange = newAmount !== debt.amount
    const hasDescriptionChange = description !== (debt.description || '')

    if (!hasAmountChange && !hasDescriptionChange) {
      toast.error('Please make at least one change')
      return
    }

    if (hasAmountChange && newAmount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setSubmitting(true)

    try {
      const result = await createDebtTransaction({
        debtId: debt.id,
        type: 'modify',
        proposedAmount: hasAmountChange ? newAmount : undefined,
        proposedDescription: hasDescriptionChange ? description : undefined,
        reason: reason || undefined,
      })

      if (result.success) {
        toast.success('Modification request sent')
        onSuccess()
        handleClose()
      } else {
        toast.error(result.error || 'Failed to create modification request')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setAmount('')
    setDescription('')
    setReason('')
    onClose()
  }

  if (!isOpen || !debt) return null

  const otherPerson = isLender ? debt.borrower : debt.lender

  // Initialize values when modal opens
  if (amount === '' && debt) {
    handleOpen()
  }

  return (
    <div className="fixed inset-0 z-50">
      <DialogOverlay onClick={handleClose} />
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full yellow-badge">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Modify Debt</DialogTitle>
              <DialogDescription>
                Request changes to this debt
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modifyAmount">Amount ($)</Label>
            <Input
              id="modifyAmount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modifyDescription">Description</Label>
            <Textarea
              id="modifyDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modifyReason">Reason for change (optional)</Label>
            <Textarea
              id="modifyReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why are you requesting this change?"
              className="resize-none"
            />
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This will send a request to <strong>{otherPerson.name || otherPerson.email}</strong> to approve these changes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Requesting...' : 'Request Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  )
}
