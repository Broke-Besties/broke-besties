'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, TrendingDown, Scale, Bell, Search, CheckCircle2, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
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

export default function DebtsPageClient({
  initialDebts,
  currentUser,
  pendingTransactionsCount,
}: DebtsPageClientProps) {
  const [debts] = useState<Debt[]>(initialDebts)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const router = useRouter()

  // Calculate totals
  const lendingDebts = debts.filter(debt => debt.lender.id === currentUser.id)
  const borrowingDebts = debts.filter(debt => debt.borrower.id === currentUser.id)

  const totalLending = lendingDebts
    .filter(d => d.status === 'pending')
    .reduce((sum, debt) => sum + debt.amount, 0)
  const totalBorrowing = borrowingDebts
    .filter(d => d.status === 'pending')
    .reduce((sum, debt) => sum + debt.amount, 0)
  const netBalance = totalLending - totalBorrowing

  // Apply filters
  let filteredDebts = debts
  if (viewFilter === 'lending') {
    filteredDebts = lendingDebts
  } else if (viewFilter === 'borrowing') {
    filteredDebts = borrowingDebts
  }

  if (statusFilter !== 'all') {
    filteredDebts = filteredDebts.filter(d => d.status === statusFilter)
  }

  // Apply search
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filteredDebts = filteredDebts.filter(debt => {
      const otherPerson = debt.lender.id === currentUser.id ? debt.borrower : debt.lender
      return (
        otherPerson.name?.toLowerCase().includes(query) ||
        otherPerson.email.toLowerCase().includes(query) ||
        debt.description?.toLowerCase().includes(query) ||
        debt.group?.name.toLowerCase().includes(query)
      )
    })
  }

  // Sort by date (most recent first)
  filteredDebts = [...filteredDebts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const getDebtDirection = (debt: Debt) => {
    return debt.lender.id === currentUser.id ? 'lending' : 'borrowing'
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
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Debts</h1>
          <p className="text-sm text-muted-foreground">
            Track money you&apos;ve lent and borrowed
          </p>
        </div>
        <Button onClick={() => setActiveModal('create')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Debt
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* You are owed (green) */}
        <button
          onClick={() => setViewFilter(viewFilter === 'lending' ? 'all' : 'lending')}
          className={cn(
            'relative rounded-xl p-4 text-left transition-all',
            viewFilter === 'lending' ? 'green-box-active' : 'green-box'
          )}
        >
          <TrendingUp className="absolute top-4 right-4 h-5 w-5 text-green" />
          <p className="text-sm text-green">You are owed</p>
          <p className="text-2xl font-bold text-green">
            ${totalLending.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {lendingDebts.filter(d => d.status === 'pending').length} pending
          </p>
        </button>

        {/* You owe (red) */}
        <button
          onClick={() => setViewFilter(viewFilter === 'borrowing' ? 'all' : 'borrowing')}
          className={cn(
            'relative rounded-xl p-4 text-left transition-all',
            viewFilter === 'borrowing' ? 'red-box-active' : 'red-box'
          )}
        >
          <TrendingDown className="absolute top-4 right-4 h-5 w-5 text-red" />
          <p className="text-sm text-red">You owe</p>
          <p className="text-2xl font-bold text-red">
            ${totalBorrowing.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {borrowingDebts.filter(d => d.status === 'pending').length} pending
          </p>
        </button>

        {/* Net balance */}
        <div className="relative rounded-xl p-4 border bg-card/50">
          <Scale className="absolute top-4 right-4 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Net balance</p>
          <p className={cn(
            'text-2xl font-bold',
            netBalance >= 0 ? 'text-green' : 'text-red'
          )}>
            {netBalance >= 0 ? '+' : '-'}${Math.abs(netBalance).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {netBalance >= 0 ? 'in your favor' : 'you owe more'}
          </p>
        </div>

        {/* Pending actions (yellow) - links to requests page */}
        <Link
          href="/debts/requests"
          className="relative rounded-xl p-4 text-left transition-all yellow-box hover:yellow-box-active"
        >
          <Bell className="absolute top-4 right-4 h-5 w-5 text-yellow" />
          <p className="text-sm text-yellow">Pending actions</p>
          <p className="text-2xl font-bold text-yellow">
            {pendingTransactionsCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            awaiting approval
          </p>
        </Link>
      </div>

      {/* Debts Table */}
      <Card>
        {/* Table Header with Filters and Search */}
        <div className="border-b p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* View Filter */}
              <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
                {(['all', 'lending', 'borrowing'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setViewFilter(view)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      viewFilter === view
                        ? view === 'lending'
                          ? 'green-badge'
                          : view === 'borrowing'
                          ? 'red-badge'
                          : 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {view === 'all' && `All (${debts.length})`}
                    {view === 'lending' && `Lending (${lendingDebts.length})`}
                    {view === 'borrowing' && `Borrowing (${borrowingDebts.length})`}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex gap-1">
                {(['all', 'pending', 'paid'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      statusFilter === status
                        ? status === 'pending'
                          ? 'yellow-badge'
                          : status === 'paid'
                          ? 'green-badge'
                          : 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search debts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredDebts.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No debts found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || viewFilter !== 'all'
                ? 'Try adjusting your filters or search'
                : 'Click "Add Debt" to create one'}
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="hidden md:table-cell">Group</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDebts.map((debt) => {
                const direction = getDebtDirection(debt)
                const otherPerson = direction === 'lending' ? debt.borrower : debt.lender
                const isLender = direction === 'lending'

                return (
                  <TableRow
                    key={debt.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/debts/${debt.id}`)}
                  >
                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        direction === 'lending' ? 'green-badge' : 'red-badge'
                      )}>
                        {direction === 'lending' ? 'Lending' : 'Borrowing'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {otherPerson.name || otherPerson.email}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground max-w-[200px] truncate">
                      {debt.description || '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {debt.group?.name || 'No group'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {new Date(debt.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {direction === 'lending' ? '+' : '-'}${debt.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        debt.status === 'pending' ? 'yellow-badge' : 'green-badge'
                      )}>
                        {debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {debt.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleAction('paid', debt)}
                            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Mark as paid"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction('modify', debt)}
                            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Modify"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction('delete', debt)}
                            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
