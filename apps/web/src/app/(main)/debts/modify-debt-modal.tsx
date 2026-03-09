'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { createDebtTransaction } from '@/app/(main)/groups/[id]/actions'

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
  const [error, setError] = useState('')

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
      setError('Please make at least one change')
      return
    }

    if (hasAmountChange && newAmount <= 0) {
      setError('Amount must be greater than 0')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const result = await createDebtTransaction({
        debtId: debt.id,
        type: 'modify',
        proposedAmount: hasAmountChange ? newAmount : undefined,
        proposedDescription: hasDescriptionChange ? description : undefined,
        reason: reason || undefined,
      })

      if (result.success) {
        onSuccess()
        handleClose()
      } else {
        setError(result.error || 'Failed to create modification request')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setAmount('')
    setDescription('')
    setReason('')
    setError('')
    onClose()
  }

  if (!debt) return null

  const otherPerson = isLender ? debt.borrower : debt.lender

  // Initialize values when modal opens
  if (amount === '' && debt) {
    handleOpen()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full yellow-badge">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle>Modify Debt</SheetTitle>
              <SheetDescription>
                Request changes to this debt
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

          <div className="space-y-2">
            <Label htmlFor="modifyAmount" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Amount ($)
            </Label>
            <Input
              id="modifyAmount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modifyDescription" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="modifyDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none text-[13px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modifyReason" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Reason for change (optional)
            </Label>
            <Textarea
              id="modifyReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why are you requesting this change?"
              className="resize-none text-[13px]"
            />
          </div>

          <div className="yellow-callout">
            <p className="text-[13px]">
              This will send a request to <strong>{otherPerson.name || otherPerson.email}</strong> to approve these changes.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Requesting...' : 'Request Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
