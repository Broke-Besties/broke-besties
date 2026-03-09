"use client"

import { Table } from "@tanstack/react-table"
import { Search, ChevronDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter"
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"
import { AmountRangeFilter } from "@/components/ui/amount-range-filter"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
}

// These match our existing badges and logic
const typeOptions = [
  { label: "Lending", value: "lending" },
  { label: "Borrowing", value: "borrowing" },
]

const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
]

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0 || table.getState().globalFilter

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative isolate group w-full sm:w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search debts..."
            value={(table.getState().globalFilter as string) ?? ""}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className="pl-9 pr-12 h-8 bg-secondary border-border/40 placeholder:text-muted-foreground"
          />
        </div>
        
        {table.getColumn("type") && (
          <DataTableFacetedFilter
            column={table.getColumn("type")}
            title="Type"
            options={typeOptions}
          />
        )}
        
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusOptions}
          />
        )}

        {table.getColumn("amount") && (
          <AmountRangeFilter column={table.getColumn("amount")} />
        )}

        {table.getColumn("createdAt") && (
          <DatePickerWithRange 
            date={table.getColumn("createdAt")?.getFilterValue() as any}
            setDate={(date) => table.getColumn("createdAt")?.setFilterValue(date)}
          />
        )}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter("")
            }}
            className="h-8 px-2 lg:px-3 text-muted-foreground hover:text-foreground"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="ml-auto h-8 border-border/40 hover:bg-muted text-foreground transition-all hidden sm:flex">
            Columns <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {table
            .getAllColumns()
            .filter(
              (column) =>
                typeof column.accessorFn !== "undefined" && column.getCanHide()
            )
            .map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id === 'personId' ? 'Person' : column.id}
                </DropdownMenuCheckboxItem>
              )
            })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
