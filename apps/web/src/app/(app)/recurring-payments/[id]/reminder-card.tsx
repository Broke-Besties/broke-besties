'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

export type ReminderAlert = {
  id: number
  message: string | null
  deadline: Date | string | null
  isActive: boolean
}

type ReminderCardProps = {
  paymentId: number
  alert: ReminderAlert | null
  isLender: boolean
  className?: string
}

function toDateInputValue(deadline: Date | string | null): string {
  if (!deadline) return ''
  return new Date(deadline).toISOString().slice(0, 10)
}

export default function ReminderCard({
  paymentId,
  alert,
  isLender,
  className,
}: ReminderCardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState(alert?.message || '')
  const [deadline, setDeadline] = useState(toDateInputValue(alert?.deadline ?? null))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const openDialog = () => {
    setMessage(alert?.message || '')
    setDeadline(toDateInputValue(alert?.deadline ?? null))
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      if (alert) {
        const response = await fetch(`/api/alerts/${alert.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message || null,
            deadline: deadline || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update reminder')
        }
      } else {
        const response = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recurringPaymentId: paymentId,
            message: message || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to create reminder')
        }
      }

      toast.success('Reminder saved')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save reminder')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAlert = async () => {
    if (!alert) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove reminder')
      }

      toast.success('Reminder removed')
      setOpen(false)
      setMessage('')
      setDeadline('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove reminder')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle>Payment reminder</CardTitle>
            <CardDescription>
              {alert
                ? 'Reminder settings for this recurring payment'
                : 'No reminder set for this recurring payment'}
            </CardDescription>
          </div>
          {isLender && (
            <Button variant="outline" size="sm" onClick={openDialog}>
              {alert ? 'Edit' : 'Add reminder'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {alert && (
          <dl className="space-y-3">
            {alert.message && (
              <div>
                <dt className="text-sm text-muted-foreground">Message</dt>
                <dd className="mt-1 text-sm">{alert.message}</dd>
              </div>
            )}
            {alert.deadline && (
              <div>
                <dt className="text-sm text-muted-foreground">Deadline</dt>
                <dd className="mt-1 text-sm">
                  {new Date(alert.deadline).toLocaleDateString()}
                </dd>
              </div>
            )}
            {!alert.message && !alert.deadline && (
              <div className="text-sm text-muted-foreground">
                Reminder is set but no message or deadline is configured.
              </div>
            )}
          </dl>
        )}
        {!isLender && (
          <FieldDescription>
            Only the lender can manage the reminder for this payment.
          </FieldDescription>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alert ? 'Edit reminder' : 'Add reminder'}</DialogTitle>
            <DialogDescription>
              Set a reminder message for this recurring payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="reminder-message">Message (optional)</FieldLabel>
              <Textarea
                id="reminder-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g., Monthly subscription reminder"
                rows={3}
              />
            </Field>
            {alert && (
              <Field>
                <FieldLabel htmlFor="reminder-deadline">
                  Deadline (optional)
                </FieldLabel>
                <Input
                  id="reminder-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <FieldDescription>
                  Leave empty to clear the deadline.
                </FieldDescription>
              </Field>
            )}
          </div>

          <DialogFooter>
            {alert && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={saving || deleting}
                    className="sm:mr-auto"
                  >
                    Remove reminder
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this reminder?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The borrower will no longer receive email reminders for
                      this recurring payment.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={buttonVariants({ variant: 'destructive' })}
                      onClick={(e) => {
                        e.preventDefault()
                        handleDeleteAlert()
                      }}
                      disabled={deleting}
                    >
                      {deleting && <Spinner />}
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting}>
              {saving && <Spinner />}
              Save reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
