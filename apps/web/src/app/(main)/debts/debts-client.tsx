'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, TrendingDown, Scale, Bell, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from './data-table'
import { getColumns } from './columns'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { CreateDebtModal } from './create-debt-modal'
import { ConfirmPaidModal } from './confirm-paid-modal'
import { ModifyDebtModal } from './modify-debt-modal'
import { DeleteDebtModal } from './delete-debt-modal'

export type Debt = {
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
export type ModalType = 'create' | 'paid' | 'modify' | 'delete' | null


export default function DebtsPageClient({
  initialDebts,
  currentUser,
  pendingTransactionsCount,
}: DebtsPageClientProps) {
  const [debts] = useState<Debt[]>(initialDebts)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [table, setTable] = useState<any>(null)
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

  // Sync UI filters with Data Table
  useEffect(() => {
    if (!table) return
    if (viewFilter === 'all') {
      table.getColumn('type')?.setFilterValue(undefined)
    } else {
      table.getColumn('type')?.setFilterValue([viewFilter])
    }
  }, [viewFilter, table])

  useEffect(() => {
    if (!table) return
    if (statusFilter === 'all') {
      table.getColumn('status')?.setFilterValue(undefined)
    } else {
      table.getColumn('status')?.setFilterValue([statusFilter])
    }
  }, [statusFilter, table])


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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
              BrokeBesties
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Debts</h1>
            <p className="text-[13px] text-muted-foreground">
              Track money you&apos;ve lent and borrowed
            </p>
          </div>
          <Button
            onClick={() => setActiveModal('create')}
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Debt
          </Button>
        </div>

        {/* Bento Stats Grid */}
        <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {/* You are owed */}
            <button
              onClick={() => setViewFilter(viewFilter === 'lending' ? 'all' : 'lending')}
              className={cn(
                'relative p-4 text-left transition-all cursor-pointer border-r border-b md:border-b-0 border-border/40',
                viewFilter === 'lending' && 'bg-accent/50'
              )}
            >
              <TrendingUp className="absolute top-4 right-4 h-4 w-4 text-money-positive/50" />
              <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                You are owed
              </p>
              <p className="text-lg font-bold font-mono tabular-nums tracking-tight text-money-positive mt-1">
                ${totalLending.toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lendingDebts.filter(d => d.status === 'pending').length} pending
              </p>
            </button>

            {/* You owe */}
            <button
              onClick={() => setViewFilter(viewFilter === 'borrowing' ? 'all' : 'borrowing')}
              className={cn(
                'relative p-4 text-left transition-all cursor-pointer border-b md:border-b-0 md:border-r border-border/40',
                viewFilter === 'borrowing' && 'bg-accent/50'
              )}
            >
              <TrendingDown className="absolute top-4 right-4 h-4 w-4 text-money-negative/50" />
              <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                You owe
              </p>
              <p className="text-lg font-bold font-mono tabular-nums tracking-tight text-money-negative mt-1">
                ${totalBorrowing.toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {borrowingDebts.filter(d => d.status === 'pending').length} pending
              </p>
            </button>

            {/* Net balance */}
            <div className="relative p-4 border-r border-border/40">
              <Scale className="absolute top-4 right-4 h-4 w-4 text-muted-foreground/30" />
              <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                Net balance
              </p>
              <p className={cn(
                'text-lg font-bold font-mono tabular-nums tracking-tight mt-1',
                netBalance >= 0 ? 'text-money-positive' : 'text-money-negative'
              )}>
                {netBalance >= 0 ? '+' : '-'}${Math.abs(netBalance).toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {netBalance >= 0 ? 'in your favor' : 'you owe more'}
              </p>
            </div>

            {/* Pending actions */}
            <Link
              href="/debts/requests"
              className="relative p-4 text-left transition-all cursor-pointer hover:bg-accent/50"
            >
              <Bell className="absolute top-4 right-4 h-4 w-4 text-money-warning/50" />
              <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                Pending actions
              </p>
              <p className="text-lg font-bold font-mono tabular-nums tracking-tight text-money-warning mt-1">
                {pendingTransactionsCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                awaiting approval
              </p>
            </Link>
          </div>
        </div>

        {/* Ledger Table */}
        <DataTable
          columns={getColumns(currentUser.id, handleAction)}
          data={debts}
          onRowClick={(debt) => router.push(`/debts/${debt.id}`)}
          onTableReady={setTable}
        />

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
    </main>
  )
}
