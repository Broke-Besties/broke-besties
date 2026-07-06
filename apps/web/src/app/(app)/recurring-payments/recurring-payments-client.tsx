'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toggleRecurringPaymentStatus } from './actions'
import { formatAmount, frequencyText, namedCadence } from './format'
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

/** Estimated cost per month, normalized from the payment's day-based cadence. */
function monthlyEstimate(amount: number, frequencyDays: number): number {
  return (amount * 30) / frequencyDays
}

export default function RecurringPaymentsClient({
  initialRecurringPayments,
  currentUser,
}: RecurringPaymentsClientProps) {
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(
    initialRecurringPayments
  )
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const handleToggleStatus = async (paymentId: number) => {
    const payment = recurringPayments.find((p) => p.id === paymentId)
    if (!payment) return

    const oldStatus = payment.status
    const nextStatus = oldStatus === 'active' ? 'inactive' : 'active'

    setTogglingId(paymentId)
    setRecurringPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: nextStatus } : p))
    )

    const revert = () => {
      setRecurringPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: oldStatus } : p))
      )
    }

    try {
      const result = await toggleRecurringPaymentStatus(paymentId)
      if (result.success) {
        toast.success(
          nextStatus === 'active'
            ? 'Recurring payment activated'
            : 'Recurring payment deactivated'
        )
      } else {
        toast.error(result.error || 'Failed to update status')
        revert()
      }
    } catch {
      toast.error('An error occurred while updating the status')
      revert()
    } finally {
      setTogglingId(null)
    }
  }

  const handleCreateSuccess = (newPayment: RecurringPayment) => {
    setRecurringPayments([newPayment, ...recurringPayments])
    setCreateOpen(false)
  }

  const lendingPayments = recurringPayments.filter(
    (payment) => payment.lender.id === currentUser.id
  )
  const borrowingPayments = recurringPayments.filter((payment) =>
    payment.borrowers.some((b) => b.userId === currentUser.id)
  )

  const activeCount = recurringPayments.filter((p) => p.status === 'active').length
  const inactiveCount = recurringPayments.length - activeCount

  const monthlyLending = lendingPayments
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => sum + monthlyEstimate(p.amount, p.frequency), 0)
  const monthlyBorrowing = borrowingPayments
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => {
      const share =
        p.borrowers.find((b) => b.userId === currentUser.id)?.splitPercentage ?? 0
      return sum + monthlyEstimate((p.amount * share) / 100, p.frequency)
    }, 0)

  let filteredPayments = recurringPayments
  if (viewFilter === 'lending') {
    filteredPayments = lendingPayments
  } else if (viewFilter === 'borrowing') {
    filteredPayments = borrowingPayments
  }

  if (statusFilter !== 'all') {
    filteredPayments = filteredPayments.filter((p) => p.status === statusFilter)
  }

  filteredPayments = [...filteredPayments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const hasFilters = viewFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring payments"
        description="Manage your recurring payments and subscriptions."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Create recurring payment
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="You lend / month"
          value={formatAmount(monthlyLending)}
          icon={ArrowUpRight}
          hint="Estimated from active payments you lend"
        />
        <StatCard
          label="You borrow / month"
          value={formatAmount(monthlyBorrowing)}
          icon={ArrowDownLeft}
          hint="Estimated from your share of active payments"
        />
        <StatCard
          label="Active payments"
          value={activeCount}
          icon={CalendarClock}
          hint={`${inactiveCount} inactive`}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={viewFilter}
            onValueChange={(v) => setViewFilter(v as ViewFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">
                All ({recurringPayments.length})
              </TabsTrigger>
              <TabsTrigger value="lending">
                Lending ({lendingPayments.length})
              </TabsTrigger>
              <TabsTrigger value="borrowing">
                Borrowing ({borrowingPayments.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredPayments.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock />
              </EmptyMedia>
              <EmptyTitle>
                {hasFilters
                  ? 'No matching recurring payments'
                  : 'No recurring payments yet'}
              </EmptyTitle>
              <EmptyDescription>
                {hasFilters
                  ? 'Try adjusting your filters.'
                  : 'Create your first recurring payment to track subscriptions and repeating IOUs.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewFilter('all')
                    setStatusFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Create recurring payment
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <ItemGroup className="gap-3">
            {filteredPayments.map((payment) => {
              const isLender = payment.lender.id === currentUser.id
              const direction = isLender ? 'Lending' : 'Borrowing'
              const cadence = namedCadence(payment.frequency)
              const isToggling = togglingId === payment.id

              return (
                <Item key={payment.id} variant="outline" className="relative">
                  <ItemContent className="gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={payment.status} />
                      <Badge variant="outline">{direction}</Badge>
                    </div>
                    <ItemTitle className="tabular-nums">
                      <Link
                        href={`/recurring-payments/${payment.id}`}
                        className="after:absolute after:inset-0 hover:underline"
                      >
                        {formatAmount(payment.amount)}{' '}
                        {frequencyText(payment.frequency)}
                      </Link>
                      {cadence && (
                        <span className="font-normal text-muted-foreground">
                          · {cadence}
                        </span>
                      )}
                    </ItemTitle>
                    {payment.description && (
                      <ItemDescription>{payment.description}</ItemDescription>
                    )}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        Lent by{' '}
                        {isLender
                          ? 'you'
                          : payment.lender.name || payment.lender.email}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {payment.borrowers.length} borrower
                        {payment.borrowers.length === 1 ? '' : 's'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Created{' '}
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </ItemContent>
                  {isLender && (
                    <ItemActions className="relative z-10">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isToggling}
                        onClick={() => handleToggleStatus(payment.id)}
                      >
                        {isToggling && <Spinner />}
                        {payment.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </ItemActions>
                  )}
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </div>

      <RecurringFormItem
        currentUser={currentUser}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
