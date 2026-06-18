'use client'

import { useState } from 'react'
import { Trash2, CircleAlert } from 'lucide-react'
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
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Textarea } from '@/components/ui/textarea'
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

export function DeleteDebtModal({
  isOpen,
  onClose,
  onSuccess,
  debt,
  isLender,
}: DeleteDebtModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    setReason('')
    setError('')
    onClose()
  }

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

  if (!debt) return null

  const otherPerson = isLender ? debt.borrower : debt.lender

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
              <Trash2 className="size-5 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle>Delete debt</DialogTitle>
              <DialogDescription>Request to remove this debt.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        <ItemGroup className="gap-0 rounded-lg border">
          <Item size="sm">
            <ItemContent>
              <ItemTitle className="font-normal text-muted-foreground">
                Amount
              </ItemTitle>
            </ItemContent>
            <span className="font-semibold tabular-nums">
              ${debt.amount.toFixed(2)}
            </span>
          </Item>
          {debt.description && (
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="font-normal text-muted-foreground">
                  Description
                </ItemTitle>
              </ItemContent>
              <span className="text-sm">{debt.description}</span>
            </Item>
          )}
          <Item size="sm">
            <ItemContent>
              <ItemTitle className="font-normal text-muted-foreground">
                {isLender ? 'Borrower' : 'Lender'}
              </ItemTitle>
            </ItemContent>
            <span className="text-sm">
              {otherPerson.name || otherPerson.email}
            </span>
          </Item>
        </ItemGroup>

        <Field>
          <FieldLabel htmlFor="deleteReason">
            Reason for deletion (optional)
          </FieldLabel>
          <Textarea
            id="deleteReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Why should this debt be deleted?"
            className="resize-none"
          />
        </Field>

        <p className="text-sm text-muted-foreground">
          This will send a request to{' '}
          <strong className="text-foreground">
            {otherPerson.name || otherPerson.email}
          </strong>{' '}
          to approve the deletion.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Requesting…' : 'Request deletion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
