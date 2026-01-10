'use client'

import { useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toggleRecurringPaymentStatus } from './actions'
import RecurringFormItem from './recurring-form-item'
import type { User } from '@supabase/supabase-js'

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

type RecurringPaymentsClientProps = {
  initialRecurringPayments: RecurringPayment[]
  currentUser: User
}

type ViewFilter = 'all' | 'lending' | 'borrowing'
type StatusFilter = 'all' | 'active' | 'inactive'

export default function RecurringPaymentsClient({
  initialRecurringPayments,
  currentUser,
}: RecurringPaymentsClientProps) {
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(initialRecurringPayments)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleToggleStatus = async (paymentId: number) => {
    const oldStatus = recurringPayments.find(p => p.id === paymentId)?.status

    setRecurringPayments(prevPayments =>
      prevPayments.map(payment =>
        payment.id === paymentId
          ? { ...payment, status: payment.status === 'active' ? 'inactive' : 'active' }
          : payment
      )
    )

    try {
      const result = await toggleRecurringPaymentStatus(paymentId)

      if (!result.success) {
        setError(result.error || 'Failed to toggle status')
        if (oldStatus) {
          setRecurringPayments(prevPayments =>
            prevPayments.map(payment =>
              payment.id === paymentId ? { ...payment, status: oldStatus } : payment
            )
          )
        }
      }
    } catch {
      setError('An error occurred while toggling the status')
      if (oldStatus) {
        setRecurringPayments(prevPayments =>
          prevPayments.map(payment =>
            payment.id === paymentId ? { ...payment, status: oldStatus } : payment
          )
        )
      }
    }
  }

  const handleCreateSuccess = (newPayment: RecurringPayment) => {
    setRecurringPayments([newPayment, ...recurringPayments])
    setShowCreateModal(false)
  }

  const lendingPayments = recurringPayments.filter(payment => payment.lender.id === currentUser.id)
  const borrowingPayments = recurringPayments.filter(payment =>
    payment.borrowers.some(b => b.userId === currentUser.id)
  )

  const activeCount = recurringPayments.filter(p => p.status === 'active').length
  const inactiveCount = recurringPayments.filter(p => p.status === 'inactive').length

  let filteredPayments = recurringPayments
  if (viewFilter === 'lending') {
    filteredPayments = lendingPayments
  } else if (viewFilter === 'borrowing') {
    filteredPayments = borrowingPayments
  }

  if (statusFilter !== 'all') {
    filteredPayments = filteredPayments.filter(p => p.status === statusFilter)
  }

  filteredPayments = [...filteredPayments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const getPaymentDirection = (payment: RecurringPayment) => {
    return payment.lender.id === currentUser.id ? 'lending' : 'borrowing'
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Recurring Payments</h1>
          <p className="text-sm text-muted-foreground">
            Manage your recurring payments and subscriptions
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Create Recurring Payment</Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Payments</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Recurring payments currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Inactive Payments</CardDescription>
            <CardTitle className="text-2xl text-gray-600 dark:text-gray-400">
              {inactiveCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Recurring payments paused or stopped
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
          {(['all', 'lending', 'borrowing'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setViewFilter(view)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewFilter === view
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {view === 'all' && `All (${recurringPayments.length})`}
              {view === 'lending' && `Lending (${lendingPayments.length})`}
              {view === 'borrowing' && `Borrowing (${borrowingPayments.length})`}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['all', 'active', 'inactive'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === status
                  ? status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : status === 'inactive'
                    ? 'bg-red-500/50 text-red-700 dark:text-red-300'
                    : 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No recurring payments found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter !== 'all' || viewFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first recurring payment'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => {
            const direction = getPaymentDirection(payment)
            const isLender = payment.lender.id === currentUser.id

            return (
              <Link
                key={payment.id}
                href={`/recurring-payments/${payment.id}`}
                className="block"
              >
                <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          direction === 'lending'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        )}>
                          {direction === 'lending' ? 'Lending' : 'Borrowing'}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            payment.status === 'active' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                            payment.status === 'inactive' && 'border-red-500/50 bg-red-500/50 text-red-700 dark:text-red-300',
                          )}
                        >
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </div>

                      <div>
                        <p className="font-medium">
                          ${payment.amount.toFixed(2)} every {payment.frequency} day{payment.frequency > 1 ? 's' : ''}
                        </p>
                        {payment.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {payment.description}
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Lender:</span> {payment.lender.name || payment.lender.email}
                        {' • '}
                        <span className="font-medium">Borrowers:</span> {payment.borrowers.map(b => b.user.name || b.user.email).join(', ')}
                        {' • '}
                        Created {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {isLender && (
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            handleToggleStatus(payment.id)
                          }}
                        >
                          {payment.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    )}
                  </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <RecurringFormItem
        currentUser={currentUser}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
    </>
  )
}
