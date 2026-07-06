'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, ReceiptText } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import type { Debt } from './types'

type GroupDebtsListProps = {
  debts: Debt[]
  currentUser: User | null
  onUpdateStatus: (debtId: number, newStatus: string) => Promise<void>
}

type FilterStatus = 'all' | 'pending' | 'paid'

export function GroupDebtsList({ debts, currentUser, onUpdateStatus }: GroupDebtsListProps) {
  const [filter, setFilter] = useState<FilterStatus>('all')

  const filteredDebts = debts.filter(debt => {
    if (filter === 'all') return true
    return debt.status === filter
  })

  const statusCounts = {
    all: debts.length,
    pending: debts.filter(d => d.status === 'pending').length,
    paid: debts.filter(d => d.status === 'paid').length,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group debts</CardTitle>
        <CardDescription>
          {debts.length} {debts.length === 1 ? 'debt' : 'debts'} in this group
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(value) => value && setFilter(value as FilterStatus)}
        >
          <ToggleGroupItem value="all">All ({statusCounts.all})</ToggleGroupItem>
          <ToggleGroupItem value="pending">Pending ({statusCounts.pending})</ToggleGroupItem>
          <ToggleGroupItem value="paid">Paid ({statusCounts.paid})</ToggleGroupItem>
        </ToggleGroup>

        {filteredDebts.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptText />
              </EmptyMedia>
              <EmptyTitle>
                {filter === 'all' ? 'No debts yet' : `No ${filter} debts`}
              </EmptyTitle>
              <EmptyDescription>
                {filter === 'all'
                  ? 'Debts in this group will show up here.'
                  : 'Try a different status filter.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {filteredDebts.map((debt) => {
              const isLender = currentUser?.id === debt.lender.id
              const isBorrower = currentUser?.id === debt.borrower.id
              const isInvolved = isLender || isBorrower
              const direction = isLender
                ? `You lent to ${debt.borrower.name || debt.borrower.email}`
                : isBorrower
                  ? `You borrowed from ${debt.lender.name || debt.lender.email}`
                  : `${debt.lender.name || debt.lender.email} → ${debt.borrower.name || debt.borrower.email}`
              return (
                <div key={debt.id} className="flex items-center gap-1">
                  <Item asChild variant="outline" size="sm" className="min-w-0 flex-1">
                    <Link href={`/debts/${debt.id}`}>
                      <ItemContent>
                        <ItemTitle>{direction}</ItemTitle>
                        {debt.description && (
                          <ItemDescription>{debt.description}</ItemDescription>
                        )}
                      </ItemContent>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            !isInvolved && 'text-muted-foreground'
                          )}
                        >
                          ${debt.amount.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={debt.status} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(debt.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </Item>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Debt actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/debts/${debt.id}`}>View debt</Link>
                      </DropdownMenuItem>
                      {debt.status === 'pending' ? (
                        <DropdownMenuItem onSelect={() => onUpdateStatus(debt.id, 'paid')}>
                          Mark as paid
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => onUpdateStatus(debt.id, 'pending')}>
                          Mark as pending
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}
