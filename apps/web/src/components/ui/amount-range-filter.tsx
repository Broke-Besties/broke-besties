"use client"

import * as React from "react"
import { Filter } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Column } from "@tanstack/react-table"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface AmountRangeFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
}

export function AmountRangeFilter<TData, TValue>({
  column,
}: AmountRangeFilterProps<TData, TValue>) {
  const filterValue = column?.getFilterValue() as [number, number] | undefined
  const min = filterValue?.[0] ?? ""
  const max = filterValue?.[1] ?? ""

  // Reset filter when empty
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === "" && max === "") {
      column?.setFilterValue(undefined)
    } else {
      column?.setFilterValue([val ? Number(val) : undefined, max ? Number(max) : undefined])
    }
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === "" && min === "") {
      column?.setFilterValue(undefined)
    } else {
      column?.setFilterValue([min ? Number(min) : undefined, val ? Number(val) : undefined])
    }
  }

  const hasFilter = min !== "" || max !== ""

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <Filter className="mr-2 h-4 w-4" />
          Amount
          {hasFilter && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                Active
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-3" align="start">
        <div className="space-y-4">
          <h4 className="font-medium leading-none text-sm">Filter by Amount</h4>
          <div className="grid gap-2">
            <div className="grid grid-cols-2 items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">Min</span>
              <Input
                id="min"
                type="number"
                placeholder="0"
                value={min}
                onChange={handleMinChange}
                className="h-8 w-24"
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <span className="text-xs text-muted-foreground w-8">Max</span>
              <Input
                id="max"
                type="number"
                placeholder="Any"
                value={max}
                onChange={handleMaxChange}
                className="h-8 w-24"
              />
            </div>
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => column?.setFilterValue(undefined)}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
