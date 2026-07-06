'use client'

import { useState } from 'react'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { createConfirmPaidTransaction } from './actions'

type ConfirmPaidModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  debt: {
    id: number
    amount: number
    description: string | null
    borrower: { name: string | null; email: string }
    lender: { name: string | null; email: string }
  } | null
  isLender: boolean
}

export function ConfirmPaidModal({
  isOpen,
  onClose,
  onSuccess,
  debt,
  isLender,
}: ConfirmPaidModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!debt) return

    setSubmitting(true)
    setError('')

    try {
      const result = await createConfirmPaidTransaction(debt.id)
      if (result.success) {
        toast.success('Payment confirmation requested')
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <CheckCircle2 className="size-5 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle>Mark as paid</DialogTitle>
              <DialogDescription>
                Confirm this debt has been settled.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
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

        <p className="text-sm text-muted-foreground">
          This will send a request to{' '}
          <strong className="text-foreground">
            {otherPerson.name || otherPerson.email}
          </strong>{' '}
          to confirm this payment has been settled.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? 'Requesting…' : 'Request confirmation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
