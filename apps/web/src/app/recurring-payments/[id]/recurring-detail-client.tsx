'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toggleRecurringPaymentStatus, deleteRecurringPayment } from '../actions'

type RecurringPaymentBorrower = {
  id: number
  userId: string
  splitPercentage: number
  user: {
    id: string
    email: string
    name: string
  }
}

type RecurringPayment = {
  id: number
  amount: number
  description: string | null
  status: string
  frequency: number
  createdAt: Date | string
  lender: {
    id: string
    email: string
    name: string
  }
  borrowers: RecurringPaymentBorrower[]
}

type RecurringDetailClientProps = {
  payment: RecurringPayment
  currentUserId: string
}

export default function RecurringDetailClient({
  payment: initialPayment,
  currentUserId,
}: RecurringDetailClientProps) {
  const [payment, setPayment] = useState<RecurringPayment>(initialPayment)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  const isLender = payment.lender.id === currentUserId
  const isBorrower = payment.borrowers.some(b => b.userId === currentUserId)

  const handleToggleStatus = async () => {
    setSubmitting(true)
    setError('')

    try {
      const result = await toggleRecurringPaymentStatus(payment.id)

      if (result.success && result.payment) {
        setPayment(result.payment)
      } else {
        setError(result.error || 'Failed to toggle status')
      }
    } catch {
      setError('An error occurred while toggling the status')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recurring payment?')) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const result = await deleteRecurringPayment(payment.id)

      if (result.success) {
        router.push('/recurring-payments')
      } else {
        setError(result.error || 'Failed to delete recurring payment')
      }
    } catch {
      setError('An error occurred while deleting the payment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Recurring Payment Details
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created {new Date(payment.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/recurring-payments')}>
          Back to List
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Payment Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Payment Information</CardTitle>
              <CardDescription className="mt-1">{payment.description || 'No description'}</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                payment.status === 'active' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                payment.status === 'inactive' && 'border-red-500/50 bg-red-500/50 text-red-700 dark:text-red-300',
              )}
            >
              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Amount</div>
            <div className="text-2xl font-semibold">${payment.amount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Frequency</div>
            <div className="text-lg">
              Every {payment.frequency} day{payment.frequency > 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lender Card */}
      <Card>
        <CardHeader>
          <CardTitle>Lender</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{payment.lender.name}</div>
              <div className="text-sm text-muted-foreground">{payment.lender.email}</div>
            </div>
            {isLender && (
              <Badge variant="secondary">You</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Borrowers Card */}
      <Card>
        <CardHeader>
          <CardTitle>Borrowers & Splits</CardTitle>
          <CardDescription>
            {payment.borrowers.length} borrower{payment.borrowers.length > 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payment.borrowers.map((borrower) => {
            const dollarAmount = (borrower.splitPercentage / 100) * payment.amount
            const isCurrentUser = borrower.userId === currentUserId

            return (
              <div
                key={borrower.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{borrower.user.name}</div>
                    {isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">{borrower.user.email}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{borrower.splitPercentage}%</div>
                  <div className="text-sm text-muted-foreground">
                    ${dollarAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      {isLender && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Manage this recurring payment</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={handleToggleStatus}
              disabled={submitting}
              variant={payment.status === 'active' ? 'secondary' : 'default'}
            >
              {submitting ? 'Updating...' : payment.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={submitting}
              variant="destructive"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
