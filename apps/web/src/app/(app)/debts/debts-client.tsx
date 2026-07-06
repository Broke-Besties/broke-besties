'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  CheckCircle2,
  Eye,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { StatusBadge } from '@/components/status-badge'
import type { User } from '@supabase/supabase-js'
import { CreateDebtModal } from './create-debt-modal'
import { ConfirmPaidModal } from './confirm-paid-modal'
import { ModifyDebtModal } from './modify-debt-modal'
import { DeleteDebtModal } from './delete-debt-modal'

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  createdAt: Date | string
  lender: {
    id: string
    name: string
    email: string
  }
  borrower: {
    id: string
    name: string
    email: string
  }
  group: {
    id: number
    name: string
  } | null
}

type DebtsPageClientProps = {
  initialDebts: Debt[]
  currentUser: User
  pendingTransactionsCount: number
}

type ViewFilter = 'all' | 'lending' | 'borrowing'
type StatusFilter = 'all' | 'pending' | 'paid'
type ModalType = 'create' | 'paid' | 'modify' | 'delete' | null
type SortKey = 'date' | 'amount'
type SortDir = 'desc' | 'asc'

function SortHeaderButton({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={className}
      aria-label={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      {active ? (
        dir === 'desc' ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUp className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3" />
      )}
    </Button>
  )
}

export default function DebtsPageClient({
  initialDebts,
  currentUser,
  pendingTransactionsCount,
}: DebtsPageClientProps) {
  const debts = initialDebts
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Command palette entry point: /debts?new=1 opens the create dialog.
  const wantsCreate = searchParams.get('new') === '1'
  const [handledCreateParam, setHandledCreateParam] = useState(false)
  if (wantsCreate && !handledCreateParam) {
    setHandledCreateParam(true)
    setActiveModal('create')
  }
  if (!wantsCreate && handledCreateParam) {
    setHandledCreateParam(false)
  }
  useEffect(() => {
    if (wantsCreate) {
      router.replace('/debts', { scroll: false })
    }
  }, [wantsCreate, router])

  const lendingDebts = debts.filter((debt) => debt.lender.id === currentUser.id)
  const borrowingDebts = debts.filter(
    (debt) => debt.borrower.id === currentUser.id
  )

  const pendingLending = lendingDebts.filter((d) => d.status === 'pending')
  const pendingBorrowing = borrowingDebts.filter((d) => d.status === 'pending')
  const totalLending = pendingLending.reduce((sum, debt) => sum + debt.amount, 0)
  const totalBorrowing = pendingBorrowing.reduce(
    (sum, debt) => sum + debt.amount,
    0
  )
  const netBalance = totalLending - totalBorrowing

  let filteredDebts = debts
  if (viewFilter === 'lending') {
    filteredDebts = lendingDebts
  } else if (viewFilter === 'borrowing') {
    filteredDebts = borrowingDebts
  }

  if (statusFilter !== 'all') {
    filteredDebts = filteredDebts.filter((d) => d.status === statusFilter)
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filteredDebts = filteredDebts.filter((debt) => {
      const otherPerson =
        debt.lender.id === currentUser.id ? debt.borrower : debt.lender
      return (
        otherPerson.name?.toLowerCase().includes(query) ||
        otherPerson.email.toLowerCase().includes(query) ||
        debt.description?.toLowerCase().includes(query) ||
        debt.group?.name.toLowerCase().includes(query)
      )
    })
  }

  filteredDebts = [...filteredDebts].sort((a, b) => {
    const valueA =
      sortKey === 'date' ? new Date(a.createdAt).getTime() : a.amount
    const valueB =
      sortKey === 'date' ? new Date(b.createdAt).getTime() : b.amount
    return sortDir === 'desc' ? valueB - valueA : valueA - valueB
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleAction = (action: ModalType, debt: Debt) => {
    setSelectedDebt(debt)
    setActiveModal(action)
  }

  const handleModalClose = () => {
    setActiveModal(null)
    setSelectedDebt(null)
  }

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debts"
        description="Track money you've lent and borrowed."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/debts/requests">
                <Inbox />
                Requests
                {pendingTransactionsCount > 0 && (
                  <Badge variant="secondary">{pendingTransactionsCount}</Badge>
                )}
              </Link>
            </Button>
            <Button onClick={() => setActiveModal('create')}>
              <Plus />
              Add debt
            </Button>
          </>
        }
      />

      {/* Summary cards (informational only — filtering lives in the toolbar) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="You are owed"
          value={`$${totalLending.toFixed(2)}`}
          icon={TrendingUp}
          hint={`${pendingLending.length} pending`}
        />
        <StatCard
          label="You owe"
          value={`$${totalBorrowing.toFixed(2)}`}
          icon={TrendingDown}
          hint={`${pendingBorrowing.length} pending`}
        />
        <StatCard
          label="Net balance"
          value={`${netBalance >= 0 ? '+' : '-'}$${Math.abs(netBalance).toFixed(2)}`}
          icon={Scale}
          hint={netBalance >= 0 ? 'in your favor' : 'you owe more'}
        />
        <StatCard
          label="Pending requests"
          value={pendingTransactionsCount}
          icon={Bell}
          hint="awaiting approval"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={viewFilter}
              onValueChange={(v) => setViewFilter(v as ViewFilter)}
            >
              <TabsList>
                <TabsTrigger value="all">All ({debts.length})</TabsTrigger>
                <TabsTrigger value="lending">
                  Lending ({lendingDebts.length})
                </TabsTrigger>
                <TabsTrigger value="borrowing">
                  Borrowing ({borrowingDebts.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search debts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filteredDebts.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No debts found</EmptyTitle>
              <EmptyDescription>
                {searchQuery || statusFilter !== 'all' || viewFilter !== 'all'
                  ? 'Try adjusting your filters or search.'
                  : 'Add a debt to start tracking.'}
              </EmptyDescription>
            </EmptyHeader>
            {!searchQuery && statusFilter === 'all' && viewFilter === 'all' && (
              <EmptyContent>
                <Button onClick={() => setActiveModal('create')}>
                  <Plus />
                  Add debt
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="hidden md:table-cell">
                  Description
                </TableHead>
                <TableHead className="hidden lg:table-cell">Group</TableHead>
                <TableHead
                  className="hidden sm:table-cell"
                  aria-sort={
                    sortKey === 'date'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <SortHeaderButton
                    label="Date"
                    active={sortKey === 'date'}
                    dir={sortDir}
                    onClick={() => handleSort('date')}
                    className="-ml-3"
                  />
                </TableHead>
                <TableHead
                  className="text-right"
                  aria-sort={
                    sortKey === 'amount'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <SortHeaderButton
                    label="Amount"
                    active={sortKey === 'amount'}
                    dir={sortDir}
                    onClick={() => handleSort('amount')}
                    className="-mr-3"
                  />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDebts.map((debt) => {
                const direction =
                  debt.lender.id === currentUser.id ? 'lending' : 'borrowing'
                const otherPerson =
                  direction === 'lending' ? debt.borrower : debt.lender

                return (
                  <TableRow
                    key={debt.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/debts/${debt.id}`)}
                  >
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge
                        status={direction}
                        label={direction === 'lending' ? 'Lending' : 'Borrowing'}
                        className="capitalize"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/debts/${debt.id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {otherPerson.name || otherPerson.email}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
                      {debt.description || '-'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {debt.group?.name || 'No group'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {new Date(debt.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {direction === 'lending' ? '+' : '-'}$
                      {debt.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={debt.status} />
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Open row actions"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/debts/${debt.id}`}>
                              <Eye />
                              View
                            </Link>
                          </DropdownMenuItem>
                          {debt.status === 'pending' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleAction('paid', debt)}
                              >
                                <CheckCircle2 />
                                Mark as paid
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAction('modify', debt)}
                              >
                                <Pencil />
                                Modify
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleAction('delete', debt)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modals */}
      <CreateDebtModal
        isOpen={activeModal === 'create'}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        currentUserId={currentUser.id}
      />

      <ConfirmPaidModal
        isOpen={activeModal === 'paid'}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={selectedDebt}
        isLender={selectedDebt?.lender.id === currentUser.id}
      />

      <ModifyDebtModal
        isOpen={activeModal === 'modify'}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={selectedDebt}
        isLender={selectedDebt?.lender.id === currentUser.id}
      />

      <DeleteDebtModal
        isOpen={activeModal === 'delete'}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={selectedDebt}
        isLender={selectedDebt?.lender.id === currentUser.id}
      />
    </div>
  )
}
