'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Pencil, Trash2, Clock, Search, ArrowUp, ArrowDown } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { respondToTransaction } from '../actions'
import { RequestDetailDialog } from './request-detail-dialog'

type Transaction = {
  id: number
  debtId: number
  type: string
  status: string
  requesterId: string
  lenderApproved: boolean
  borrowerApproved: boolean
  proposedAmount: number | null
  proposedDescription: string | null
  reason: string | null
  createdAt: string | Date
  debt: {
    id: number
    amount: number
    description: string | null
    lenderId: string
    borrowerId: string
    lender: { id: string; name: string; email: string }
    borrower: { id: string; name: string; email: string }
    group: { id: number; name: string } | null
  }
  requester: { id: string; name: string; email: string }
}

type RequestsPageClientProps = {
  initialTransactions: Transaction[]
  currentUserId: string
}

type TypeFilter = 'all' | 'confirm_paid' | 'modify' | 'drop'
type ActionFilter = 'all' | 'needs_approval' | 'waiting'
type SortOrder = 'desc' | 'asc'

export default function RequestsPageClient({
  initialTransactions,
  currentUserId,
}: RequestsPageClientProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [responding, setResponding] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [detailDialogTransaction, setDetailDialogTransaction] = useState<Transaction | null>(null)
  const router = useRouter()

  const handleRespond = async (transactionId: number, approve: boolean) => {
    setResponding(transactionId)
    const result = await respondToTransaction(transactionId, approve)
    if (result.success) {
      // Remove the transaction from the list
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      router.refresh()
    }
    setResponding(null)
  }

  const needsMyApproval = (transaction: Transaction) => {
    const isLender = transaction.debt.lenderId === currentUserId
    const isBorrower = transaction.debt.borrowerId === currentUserId

    if (isLender && !transaction.lenderApproved) return true
    if (isBorrower && !transaction.borrowerApproved) return true
    return false
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'confirm_paid':
        return <CheckCircle2 className="h-4 w-4" />
      case 'modify':
        return <Pencil className="h-4 w-4" />
      case 'drop':
        return <Trash2 className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'confirm_paid':
        return 'Payment Confirmation'
      case 'modify':
        return 'Modification'
      case 'drop':
        return 'Deletion'
      default:
        return type
    }
  }

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'confirm_paid':
        return 'green-badge'
      case 'modify':
        return 'yellow-badge'
      case 'drop':
        return 'red-badge'
      default:
        return ''
    }
  }

  // Get unique groups for filter
  const uniqueGroups = Array.from(
    new Set(
      transactions
        .filter(t => t.debt.group)
        .map(t => JSON.stringify({ id: t.debt.group!.id, name: t.debt.group!.name }))
    )
  ).map(str => JSON.parse(str))

  // Apply filters
  let filteredTransactions = transactions

  if (typeFilter !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.type === typeFilter)
  }

  if (actionFilter === 'needs_approval') {
    filteredTransactions = filteredTransactions.filter(t => needsMyApproval(t))
  } else if (actionFilter === 'waiting') {
    filteredTransactions = filteredTransactions.filter(t => !needsMyApproval(t))
  }

  if (groupFilter !== 'all') {
    filteredTransactions = filteredTransactions.filter(t =>
      t.debt.group?.id.toString() === groupFilter
    )
  }

  // Apply search
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filteredTransactions = filteredTransactions.filter(transaction => {
      const isLender = transaction.debt.lenderId === currentUserId
      const otherPerson = isLender ? transaction.debt.borrower : transaction.debt.lender
      return (
        otherPerson.name?.toLowerCase().includes(query) ||
        otherPerson.email.toLowerCase().includes(query) ||
        transaction.debt.description?.toLowerCase().includes(query) ||
        transaction.debt.group?.name.toLowerCase().includes(query) ||
        transaction.reason?.toLowerCase().includes(query)
      )
    })
  }

  // Sort by date
  filteredTransactions = [...filteredTransactions].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
  })

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/debts">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Pending Requests</h1>
          <p className="text-sm text-muted-foreground">
            Review and respond to pending debt requests
          </p>
        </div>
      </div>

      {/* Requests Table */}
      <Card>
        {/* Table Header with Filters and Search */}
        <div className="border-b p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
                {(['all', 'confirm_paid', 'modify', 'drop'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      typeFilter === type
                        ? type === 'confirm_paid'
                          ? 'green-badge'
                          : type === 'modify'
                          ? 'yellow-badge'
                          : type === 'drop'
                          ? 'red-badge'
                          : 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {type === 'all' && 'All'}
                    {type === 'confirm_paid' && 'Paid'}
                    {type === 'modify' && 'Modify'}
                    {type === 'drop' && 'Delete'}
                  </button>
                ))}
              </div>

              {/* Action Filter */}
              <div className="flex gap-1">
                {(['all', 'needs_approval', 'waiting'] as const).map((action) => (
                  <button
                    key={action}
                    onClick={() => setActionFilter(action)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      actionFilter === action
                        ? action === 'needs_approval'
                          ? 'red-badge'
                          : action === 'waiting'
                          ? 'yellow-badge'
                          : 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {action === 'all' && 'All'}
                    {action === 'needs_approval' && 'Needs My Approval'}
                    {action === 'waiting' && 'Waiting'}
                  </button>
                ))}
              </div>

              {/* Group Filter */}
              {uniqueGroups.length > 0 && (
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {uniqueGroups.map((group: { id: number; name: string }) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Click on a row to view details and take action</p>
        </div>

        {/* Table Content */}
        {filteredTransactions.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-12">
            {transactions.length === 0 ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No pending requests</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You&apos;re all caught up!
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">No requests found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your filters or search
                </p>
              </>
            )}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Person</TableHead>
                <TableHead className="hidden sm:table-cell">Group</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden sm:table-cell">
                  <button
                    onClick={toggleSortOrder}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Date
                    {sortOrder === 'desc' ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => {
                const isLender = transaction.debt.lenderId === currentUserId
                const otherPerson = isLender ? transaction.debt.borrower : transaction.debt.lender
                const isRequester = transaction.requesterId === currentUserId
                const needsApproval = needsMyApproval(transaction)

                return (
                  <TableRow
                    key={transaction.id}
                    className="cursor-pointer h-16"
                    onClick={() => setDetailDialogTransaction(transaction)}
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full',
                          getTypeBadgeClass(transaction.type)
                        )}>
                          {getTypeIcon(transaction.type)}
                        </div>
                        <span className="text-sm font-medium hidden lg:inline">
                          {getTypeLabel(transaction.type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{otherPerson.name || otherPerson.email}</span>
                        {isRequester ? (
                          <span className="text-xs text-muted-foreground">You requested</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Requested by {transaction.requester.name || 'them'}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 hidden sm:table-cell text-muted-foreground">
                      {transaction.debt.group?.name || 'No group'}
                    </TableCell>
                    <TableCell className="py-4 hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          {transaction.lenderApproved ? (
                            <CheckCircle2 className="h-3 w-3 text-green" />
                          ) : (
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">Lender</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {transaction.borrowerApproved ? (
                            <CheckCircle2 className="h-3 w-3 text-green" />
                          ) : (
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">Borrower</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 hidden sm:table-cell text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-4 text-right font-semibold">
                      ${transaction.debt.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="py-4">
                      {needsApproval ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium red-badge">
                          Action needed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium yellow-badge">
                          Waiting
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Detail Dialog */}
      <RequestDetailDialog
        transaction={detailDialogTransaction}
        isOpen={detailDialogTransaction !== null}
        onClose={() => setDetailDialogTransaction(null)}
        currentUserId={currentUserId}
        onApprove={(transaction) => handleRespond(transaction.id, true)}
        onReject={(transaction) => handleRespond(transaction.id, false)}
        responding={responding !== null}
      />
    </div>
  )
}
