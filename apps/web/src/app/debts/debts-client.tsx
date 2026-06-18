'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Scale,
  Bell,
  Search,
  CheckCircle2,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Receipt,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
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
type SortOrder = 'desc' | 'asc'

export default function DebtsPageClient({
  initialDebts,
  currentUser,
  pendingTransactionsCount,
}: DebtsPageClientProps) {
  const [debts] = useState<Debt[]>(initialDebts)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const router = useRouter()

  const lendingDebts = debts.filter((debt) => debt.lender.id === currentUser.id)
  const borrowingDebts = debts.filter(
    (debt) => debt.borrower.id === currentUser.id
  )

  const totalLending = lendingDebts
    .filter((d) => d.status === 'pending')
    .reduce((sum, debt) => sum + debt.amount, 0)
  const totalBorrowing = borrowingDebts
    .filter((d) => d.status === 'pending')
    .reduce((sum, debt) => sum + debt.amount, 0)
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
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
  })

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Debts
          </h1>
          <p className="text-sm text-muted-foreground">
            Track money you&apos;ve lent and borrowed.
          </p>
        </div>
        <Button onClick={() => setActiveModal('create')}>
          <Plus />
          Add debt
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card
          role="button"
          tabIndex={0}
          onClick={() =>
            setViewFilter(viewFilter === 'lending' ? 'all' : 'lending')
          }
          className={cn(
            'cursor-pointer transition-colors hover:bg-accent/50',
            viewFilter === 'lending' && 'border-ring ring-1 ring-ring'
          )}
        >
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              You are owed
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              ${totalLending.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {lendingDebts.filter((d) => d.status === 'pending').length} pending
            </p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() =>
            setViewFilter(viewFilter === 'borrowing' ? 'all' : 'borrowing')
          }
          className={cn(
            'cursor-pointer transition-colors hover:bg-accent/50',
            viewFilter === 'borrowing' && 'border-ring ring-1 ring-ring'
          )}
        >
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              You owe
            </CardTitle>
            <TrendingDown className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              ${totalBorrowing.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {borrowingDebts.filter((d) => d.status === 'pending').length}{' '}
              pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net balance
            </CardTitle>
            <Scale className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {netBalance >= 0 ? '+' : '-'}${Math.abs(netBalance).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {netBalance >= 0 ? 'in your favor' : 'you owe more'}
            </p>
          </CardContent>
        </Card>

        <Link href="/debts/requests" className="block">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending actions
              </CardTitle>
              <Bell className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {pendingTransactionsCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                awaiting approval
              </p>
            </CardContent>
          </Card>
        </Link>
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
                <TableHead>Type</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Description
                </TableHead>
                <TableHead className="hidden md:table-cell">Group</TableHead>
                <TableHead className="hidden sm:table-cell">
                  <button
                    onClick={toggleSortOrder}
                    className="flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    Date
                    {sortOrder === 'desc' ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUp className="size-3" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell>
                      <Badge variant="outline">
                        {direction === 'lending' ? 'Lending' : 'Borrowing'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {otherPerson.name || otherPerson.email}
                    </TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-muted-foreground sm:table-cell">
                      {debt.description || '-'}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
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
                      <Badge
                        variant={
                          debt.status === 'pending' ? 'secondary' : 'outline'
                        }
                      >
                        {debt.status.charAt(0).toUpperCase() +
                          debt.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {debt.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleAction('paid', debt)}
                            title="Mark as paid"
                          >
                            <CheckCircle2 />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleAction('modify', debt)}
                            title="Modify"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleAction('delete', debt)}
                            title="Delete"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
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
