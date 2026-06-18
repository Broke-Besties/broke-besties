'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(
    initialRecurringPayments
  )
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleToggleStatus = async (paymentId: number) => {
    const oldStatus = recurringPayments.find((p) => p.id === paymentId)?.status

    setRecurringPayments((prev) =>
      prev.map((payment) =>
        payment.id === paymentId
          ? {
              ...payment,
              status: payment.status === 'active' ? 'inactive' : 'active',
            }
          : payment
      )
    )

    const revert = () => {
      if (oldStatus) {
        setRecurringPayments((prev) =>
          prev.map((payment) =>
            payment.id === paymentId
              ? { ...payment, status: oldStatus }
              : payment
          )
        )
      }
    }

    try {
      const result = await toggleRecurringPaymentStatus(paymentId)
      if (!result.success) {
        toast.error(result.error || 'Failed to toggle status')
        revert()
      }
    } catch {
      toast.error('An error occurred while toggling the status')
      revert()
    }
  }

  const handleCreateSuccess = (newPayment: RecurringPayment) => {
    setRecurringPayments([newPayment, ...recurringPayments])
    setShowCreateModal(false)
  }

  const lendingPayments = recurringPayments.filter(
    (payment) => payment.lender.id === currentUser.id
  )
  const borrowingPayments = recurringPayments.filter((payment) =>
    payment.borrowers.some((b) => b.userId === currentUser.id)
  )

  const activeCount = recurringPayments.filter((p) => p.status === 'active').length
  const inactiveCount = recurringPayments.filter(
    (p) => p.status === 'inactive'
  ).length

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Recurring payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your recurring payments and subscriptions.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus />
          Create
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Active payments</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{activeCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Recurring payments currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Inactive payments</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
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
            <EmptyTitle>No recurring payments found</EmptyTitle>
            <EmptyDescription>
              {statusFilter !== 'all' || viewFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Create your first recurring payment.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {filteredPayments.map((payment) => {
            const isLender = payment.lender.id === currentUser.id
            const direction = isLender ? 'Lending' : 'Borrowing'

            return (
              <Item key={payment.id} asChild variant="outline">
                <Link href={`/recurring-payments/${payment.id}`}>
                  <ItemContent className="gap-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{direction}</Badge>
                      <Badge
                        variant={
                          payment.status === 'active' ? 'secondary' : 'outline'
                        }
                      >
                        {payment.status.charAt(0).toUpperCase() +
                          payment.status.slice(1)}
                      </Badge>
                    </div>
                    <ItemTitle className="tabular-nums">
                      ${payment.amount.toFixed(2)} every {payment.frequency} day
                      {payment.frequency > 1 ? 's' : ''}
                    </ItemTitle>
                    {payment.description && (
                      <ItemDescription>{payment.description}</ItemDescription>
                    )}
                    <ItemDescription>
                      Lender: {payment.lender.name || payment.lender.email} ·
                      Borrowers:{' '}
                      {payment.borrowers
                        .map((b) => b.user.name || b.user.email)
                        .join(', ')}{' '}
                      · Created {new Date(payment.createdAt).toLocaleDateString()}
                    </ItemDescription>
                  </ItemContent>
                  {isLender && (
                    <ItemActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleToggleStatus(payment.id)
                        }}
                      >
                        {payment.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </ItemActions>
                  )}
                </Link>
              </Item>
            )
          })}
        </ItemGroup>
      )}

      <RecurringFormItem
        currentUser={currentUser}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
