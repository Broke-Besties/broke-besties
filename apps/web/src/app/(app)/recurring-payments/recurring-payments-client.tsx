'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Plus,
  Search,
  X,
} from 'lucide-react'
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { pageBounds } from '../debts/pagination'
import { cn } from '@/lib/utils'
import {
  filterRecurringPayments,
  type PaymentFilters,
  type RecurringPayment,
} from './payment-list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { toggleRecurringPaymentStatus } from './actions'
import { formatAmount, frequencyText, namedCadence } from './format'
import RecurringFormItem from './recurring-form-item'
import type { User } from '@supabase/supabase-js'

type RecurringPaymentsClientProps = {
  initialRecurringPayments: RecurringPayment[]
  currentUser: User
}

const DEFAULT_FILTERS: PaymentFilters = {
  view: 'all',
  status: 'all',
  person: 'all',
  group: 'all',
  search: '',
}

/** Estimated cost per month, normalized from the payment's day-based cadence. */
function monthlyEstimate(amount: number, frequencyDays: number): number {
  return (amount * 30) / frequencyDays
}

export default function RecurringPaymentsClient({
  initialRecurringPayments,
  currentUser,
}: RecurringPaymentsClientProps) {
  const [recurringPayments, setRecurringPayments] = useState<
    RecurringPayment[]
  >(initialRecurringPayments)
  const [filters, setFilters] = useState<PaymentFilters>(DEFAULT_FILTERS)
  const [requestedPage, setRequestedPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const updateFilters = (patch: Partial<PaymentFilters>) => {
    setFilters((previous) => ({ ...previous, ...patch }))
    setRequestedPage(1)
  }
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setRequestedPage(1)
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const handleToggleStatus = async (paymentId: number) => {
    const payment = recurringPayments.find((p) => p.id === paymentId)
    if (!payment || togglingId !== null) return

    const oldStatus = payment.status
    const nextStatus = oldStatus === 'active' ? 'inactive' : 'active'

    setTogglingId(paymentId)
    setRecurringPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: nextStatus } : p)),
    )

    const revert = () => {
      setRecurringPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: oldStatus } : p)),
      )
    }

    try {
      const result = await toggleRecurringPaymentStatus(paymentId)
      if (result.success) {
        toast.success(
          nextStatus === 'active'
            ? 'Recurring payment activated'
            : 'Recurring payment deactivated',
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
    setRecurringPayments((previous) => [newPayment, ...previous])
    clearFilters()
    setCreateOpen(false)
  }

  const lendingPayments = recurringPayments.filter(
    (payment) => payment.lender.id === currentUser.id,
  )
  const borrowingPayments = recurringPayments.filter((payment) =>
    payment.borrowers.some((b) => b.userId === currentUser.id),
  )

  const activeCount = recurringPayments.filter(
    (p) => p.status === 'active',
  ).length
  const inactiveCount = recurringPayments.length - activeCount

  const monthlyLending = lendingPayments
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => sum + monthlyEstimate(p.amount, p.frequency), 0)
  const monthlyBorrowing = borrowingPayments
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => {
      const share =
        p.borrowers.find((b) => b.userId === currentUser.id)?.splitPercentage ??
        0
      return sum + monthlyEstimate((p.amount * share) / 100, p.frequency)
    }, 0)

  const filteredPayments = filterRecurringPayments(
    recurringPayments,
    currentUser.id,
    filters,
  )
  const { page, pageCount, start, end } = pageBounds(
    filteredPayments.length,
    requestedPage,
    pageSize,
  )
  const visiblePayments = filteredPayments.slice(start, end)
  const hasFilters =
    filters.view !== 'all' ||
    filters.status !== 'all' ||
    filters.person !== 'all' ||
    filters.group !== 'all' ||
    !!filters.search.trim()
  const people = Array.from(
    new Map(
      recurringPayments
        .flatMap((payment) => [
          payment.lender,
          ...payment.borrowers.map((b) => b.user),
        ])
        .map((person) => [person.id, person]),
    ).values(),
  )
    .filter((person) => person.id !== currentUser.id)
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
  const groups = Array.from(
    new Map(
      recurringPayments
        .flatMap((payment) => (payment.group ? [payment.group] : []))
        .map((group) => [group.id, group]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Recurring payments"
        description="Keep track of shared subscriptions, repeating expenses, and who’s involved."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
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

      <Card className="min-w-0">
        <CardHeader className="gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Your recurring payments</CardTitle>
              <CardDescription>
                Find a payment by its name, people, or group.
              </CardDescription>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-label="Payment direction"
              value={filters.view}
              onValueChange={(view) =>
                view && updateFilters({ view: view as PaymentFilters['view'] })
              }
            >
              <ToggleGroupItem value="all">
                All{' '}
                <span className="hidden sm:inline">
                  ({recurringPayments.length})
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem value="lending">
                Lending{' '}
                <span className="hidden sm:inline">
                  ({lendingPayments.length})
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem value="borrowing">
                Borrowing{' '}
                <span className="hidden sm:inline">
                  ({borrowingPayments.length})
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <FieldGroup className="flex-row flex-wrap items-end gap-3">
            <Field className="min-w-48 flex-1">
              <FieldLabel htmlFor="recurring-search">Search</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="recurring-search"
                  placeholder="Search payments, people, groups…"
                  value={filters.search}
                  onChange={(event) =>
                    updateFilters({ search: event.target.value })
                  }
                />
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field className="w-full sm:w-36">
              <FieldLabel htmlFor="recurring-status">Status</FieldLabel>
              <Select
                value={filters.status}
                onValueChange={(status) =>
                  updateFilters({ status: status as PaymentFilters['status'] })
                }
              >
                <SelectTrigger id="recurring-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-full sm:w-44">
              <FieldLabel htmlFor="recurring-person">Person</FieldLabel>
              <Select
                value={filters.person}
                onValueChange={(person) => updateFilters({ person })}
              >
                <SelectTrigger id="recurring-person" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All people</SelectItem>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name || person.email}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="w-full sm:w-44">
              <FieldLabel htmlFor="recurring-group">Group</FieldLabel>
              <Select
                value={filters.group}
                onValueChange={(group) => updateFilters({ group })}
              >
                <SelectTrigger id="recurring-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All groups</SelectItem>
                    <SelectItem value="none">No group</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={clearFilters}
            >
              <X data-icon="inline-start" />
              Clear filters
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {filteredPayments.length === 0 ? (
            <Empty className="border-t py-12">
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
                    ? 'Try another search or clear your filters to see all payments.'
                    : 'Add a shared subscription or repeating expense to get started.'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {hasFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus data-icon="inline-start" />
                    Create recurring payment
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Recurring payments, newest first. Amounts are the total per
                cycle; your share is shown when you borrow.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 sm:pl-6">Payment</TableHead>
                  <TableHead>Amount / cycle</TableHead>
                  <TableHead>People</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePayments.map((payment) => {
                  const isLender = payment.lender.id === currentUser.id
                  const share = payment.borrowers.find(
                    (borrower) => borrower.userId === currentUser.id,
                  )?.splitPercentage
                  const isToggling = togglingId === payment.id
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="min-w-56 max-w-80 whitespace-normal py-4 pl-4 sm:pl-6">
                        <div className="flex flex-col gap-1.5">
                          <Link
                            href={`/recurring-payments/${payment.id}`}
                            className="font-medium hover:underline"
                          >
                            {payment.description || 'Recurring payment'}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {isLender ? 'Lending' : 'Borrowing'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {namedCadence(payment.frequency) ||
                                frequencyText(payment.frequency)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {formatAmount(payment.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {share !== undefined
                              ? `Your share ${formatAmount((payment.amount * share) / 100)}`
                              : frequencyText(payment.frequency)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-44 max-w-64 whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">
                            From{' '}
                            {isLender
                              ? 'you'
                              : payment.lender.name || payment.lender.email}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            To{' '}
                            {payment.borrowers
                              .map((borrower) =>
                                borrower.userId === currentUser.id
                                  ? 'you'
                                  : borrower.user.name || borrower.user.email,
                              )
                              .join(', ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-32 max-w-44 whitespace-normal">
                        {payment.group ? (
                          <Link
                            href={`/groups/${payment.group.id}`}
                            className="text-sm hover:underline"
                          >
                            {payment.group.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No group
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="pr-4 text-right sm:pr-6">
                        {isLender ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={togglingId !== null}
                            onClick={() => handleToggleStatus(payment.id)}
                            aria-label={`${payment.status === 'active' ? 'Deactivate' : 'Activate'} ${payment.description || 'recurring payment'}`}
                          >
                            {isToggling && <Spinner />}
                            {payment.status === 'active'
                              ? 'Deactivate'
                              : 'Activate'}
                          </Button>
                        ) : (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/recurring-payments/${payment.id}`}>
                              View
                              <span className="sr-only">
                                {' '}
                                {payment.description || 'recurring payment'}
                              </span>
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredPayments.length > 0 && (
          <CardFooter className="flex flex-wrap justify-between gap-3 border-t p-4 sm:px-6">
            <p className="text-sm text-muted-foreground" role="status">
              {start + 1}–{end} of {filteredPayments.length} payments
              {hasFilters ? ` (${recurringPayments.length} total)` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setRequestedPage(1)
                }}
              >
                <SelectTrigger className="w-28" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[10, 25, 50].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} / page
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Pagination
                className="mx-0 w-auto"
                aria-label="Recurring payment pages"
              >
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={page === 1}
                      tabIndex={page === 1 ? -1 : undefined}
                      className={cn(
                        page === 1 && 'pointer-events-none opacity-50',
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        if (page > 1) setRequestedPage(page - 1)
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-sm">
                      Page {page} of {pageCount}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={page === pageCount}
                      tabIndex={page === pageCount ? -1 : undefined}
                      className={cn(
                        page === pageCount && 'pointer-events-none opacity-50',
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        if (page < pageCount) setRequestedPage(page + 1)
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardFooter>
        )}
      </Card>

      <RecurringFormItem
        currentUser={currentUser}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
