"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, CheckCircle2, Pencil, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import type { Debt, ModalType } from "./debts-client"

const getInitials = (name: string) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export const getColumns = (
  currentUserId: string,
  handleAction: (type: ModalType, debt: Debt) => void
): ColumnDef<Debt>[] => [
  {
    id: "type",
    header: "Type",
    accessorFn: (row) => row.lender.id === currentUserId ? 'lending' : 'borrowing',
    cell: ({ row }) => {
      const direction = row.getValue("type") as string
      return (
        <Badge
          variant="outline"
          className={cn(
            'border-0',
            direction === 'lending' ? 'green-badge' : 'red-badge'
          )}
        >
          {direction === 'lending' ? 'Lending' : 'Borrowing'}
        </Badge>
      )
    },
    enableSorting: false,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: "personId",
    header: "Person",
    accessorFn: (row) => {
      const direction = row.lender.id === currentUserId ? 'lending' : 'borrowing'
      const otherPerson = direction === 'lending' ? row.borrower : row.lender
      return otherPerson.name || otherPerson.email
    },
    cell: ({ row }) => {
      const debt = row.original
      const direction = debt.lender.id === currentUserId ? 'lending' : 'borrowing'
      const otherPerson = direction === 'lending' ? debt.borrower : debt.lender
      const initials = getInitials(otherPerson.name || otherPerson.email.split('@')[0])

      return (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary border border-border/40 text-xs font-semibold text-foreground">
            {initials}
          </div>
          <span className="font-medium truncate max-w-[150px]">
            {otherPerson.name || otherPerson.email}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const desc = row.getValue("description") as string | null
      return (
        <div className="hidden sm:block text-muted-foreground max-w-[180px] truncate">
          {desc || '—'}
        </div>
      )
    },
  },
  {
    id: "group",
    header: "Group",
    accessorFn: (row) => row.group?.name || '—',
    cell: ({ row }) => {
      return (
        <div className="hidden md:block text-muted-foreground">
          {row.getValue("group")}
        </div>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <div className="hidden sm:flex">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-8 data-[state=open]:bg-accent hover:text-foreground text-muted-foreground"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const dateStr = row.getValue("createdAt") as string | Date
      return (
        <div className="hidden sm:block text-muted-foreground">
          {new Date(dateStr).toLocaleDateString()}
        </div>
      )
    },
    filterFn: (row, id, value) => {
      if (!value) return true
      const dateStr = row.getValue(id) as string | Date
      const date = new Date(dateStr)
      // Reset time to start of day for comparison
      date.setHours(0, 0, 0, 0)
      
      const from = value.from ? new Date(value.from) : undefined
      if (from) from.setHours(0, 0, 0, 0)
      
      const to = value.to ? new Date(value.to) : undefined
      if (to) to.setHours(23, 59, 59, 999)
      
      if (from && date < from) return false
      if (to && date > to) return false
      return true
    },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const debt = row.original
      const direction = debt.lender.id === currentUserId ? 'lending' : 'borrowing'
      const amount = parseFloat(row.getValue("amount"))

      return (
        <div className="text-right">
          <span className={cn(
            'font-medium',
            direction === 'lending' ? 'text-money-positive' : 'text-money-negative'
          )}>
            {direction === 'lending' ? '+' : '-'}${amount.toFixed(2)}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      if (!value) return true
      const amount = parseFloat(row.getValue(id))
      const [min, max] = value as [number | undefined, number | undefined]
      if (min !== undefined && amount < min) return false
      if (max !== undefined && amount > max) return false
      return true
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge
          variant="outline"
          className={cn(
            'border-0',
            status === 'pending' ? 'yellow-badge' : 'green-badge'
          )}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const debt = row.original

      if (debt.status !== 'pending') return null

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleAction('paid', debt)}
                className="cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Paid
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleAction('modify', debt)}
                className="cursor-pointer"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Modify
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleAction('delete', debt)}
                className="text-destructive cursor-pointer focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]
