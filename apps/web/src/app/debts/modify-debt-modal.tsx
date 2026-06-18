'use client'

import { useState } from 'react'
import { Pencil, CircleAlert } from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

export function ModifyDebtModal({
  isOpen,
  onClose,
  onSuccess,
  debt,
  isLender,
}: ModifyDebtModalProps) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    setAmount('')
    setDescription('')
    setReason('')
    setError('')
    onClose()
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

  if (!debt) return null

  const otherPerson = isLender ? debt.borrower : debt.lender

  // Initialize values when the modal opens.
  if (isOpen && amount === '') {
    setAmount(debt.amount.toString())
    setDescription(debt.description || '')
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Pencil className="size-5 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle>Modify debt</DialogTitle>
              <DialogDescription>
                Request changes to this debt.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="modifyAmount">Amount ($)</FieldLabel>
          <Input
            id="modifyAmount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="modifyDescription">Description</FieldLabel>
          <Textarea
            id="modifyDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="resize-none"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="modifyReason">
            Reason for change (optional)
          </FieldLabel>
          <Textarea
            id="modifyReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Why are you requesting this change?"
            className="resize-none"
          />
        </Field>

        <p className="text-sm text-muted-foreground">
          This will send a request to{' '}
          <strong className="text-foreground">
            {otherPerson.name || otherPerson.email}
          </strong>{' '}
          to approve these changes.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Requesting…' : 'Request changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
