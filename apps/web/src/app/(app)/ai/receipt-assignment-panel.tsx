'use client'

import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { MultiSelect } from '@/components/ui/multi-select'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'

export type ReceiptItemAssignment = {
  borrowerId: string
  amount: number
  description: string
}

export type AssignableItem = {
  id: string
  name: string
  price: number
}

export type GroupMemberOption = {
  id: string
  name: string
}

type ReceiptAssignmentPanelProps = {
  items: AssignableItem[]
  members: GroupMemberOption[]
  isCreating: boolean
  onCreate: (assignments: ReceiptItemAssignment[]) => void
  onCancel: () => void
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function ReceiptAssignmentPanel({
  items,
  members,
  isCreating,
  onCreate,
  onCancel,
}: ReceiptAssignmentPanelProps) {
  // memberIds chosen per item, by item id
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})
  const [editedItems, setEditedItems] = useState<AssignableItem[]>(items)

  const memberOptions = members.map((member) => ({
    value: member.id,
    label: member.name,
  }))

  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members],
  )

  const setItemMembers = (itemId: string, memberIds: string[]) => {
    setAssignments((prev) => ({ ...prev, [itemId]: memberIds }))
  }

  const editItem = (itemId: string, patch: Partial<AssignableItem>) => {
    setEditedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    )
  }

  const assignAllToEveryone = () => {
    const allIds = members.map((member) => member.id)
    setAssignments(
      Object.fromEntries(editedItems.map((item) => [item.id, allIds])),
    )
  }

  const clearAll = () => {
    setAssignments(Object.fromEntries(editedItems.map((item) => [item.id, []])))
  }

  // Build per-borrower debts: each item is split equally across its assignees
  const buildAssignments = (): ReceiptItemAssignment[] => {
    const debtByBorrower = new Map<
      string,
      { amount: number; items: string[] }
    >()

    for (const item of editedItems) {
      const assignees = assignments[item.id] || []
      if (assignees.length === 0) continue

      const share = round2(item.price / assignees.length)

      for (const borrowerId of assignees) {
        const debt = debtByBorrower.get(borrowerId) || {
          amount: 0,
          items: [],
        }
        debt.amount = round2(debt.amount + share)
        debt.items.push(item.name)
        debtByBorrower.set(borrowerId, debt)
      }
    }

    return Array.from(debtByBorrower.entries()).map(([borrowerId, debt]) => ({
      borrowerId,
      amount: debt.amount,
      description: debt.items.join(', '),
    }))
  }

  const perBorrowerTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of editedItems) {
      const assignees = assignments[item.id] || []
      if (assignees.length === 0) continue
      const share = round2(item.price / assignees.length)
      for (const borrowerId of assignees) {
        totals.set(borrowerId, round2((totals.get(borrowerId) || 0) + share))
      }
    }
    return totals
  }, [editedItems, assignments])

  const unassignedCount = editedItems.filter(
    (item) => !assignments[item.id] || assignments[item.id].length === 0,
  ).length

  const hasInvalidItem = editedItems.some(
    (item) => !item.name.trim() || isNaN(item.price) || item.price < 0,
  )

  const debts = buildAssignments()

  return (
    <Card className="w-full min-w-0 shadow-none">
      <CardHeader className="gap-2 p-4">
        <CardTitle>Review & split</CardTitle>
        <CardDescription>
          Edit anything the scan missed, then choose who had each item.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {editedItems.length} item{editedItems.length > 1 ? 's' : ''} parsed
          </Badge>
          {unassignedCount > 0 && (
            <Badge variant="outline">{unassignedCount} unassigned</Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={assignAllToEveryone}
              disabled={isCreating || members.length === 0}
            >
              <Users />
              Split all evenly
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={isCreating}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {editedItems.map((item) => {
            const assignees = assignments[item.id] || []
            const share =
              assignees.length > 0
                ? round2(item.price / assignees.length)
                : null
            return (
              <div key={item.id} className="min-w-0 rounded-lg border p-3">
                <FieldGroup className="flex-row items-end gap-2">
                  <Field className="min-w-0 flex-1">
                    <FieldLabel htmlFor={`item-name-${item.id}`}>
                      Item
                    </FieldLabel>
                    <Input
                      id={`item-name-${item.id}`}
                      value={item.name}
                      onChange={(e) =>
                        editItem(item.id, { name: e.target.value })
                      }
                      className="h-8 flex-1"
                      disabled={isCreating}
                      aria-label="Item name"
                    />
                  </Field>
                  <Field className="w-24 shrink-0">
                    <FieldLabel htmlFor={`item-price-${item.id}`}>
                      Price ($)
                    </FieldLabel>
                    <Input
                      id={`item-price-${item.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.price}
                      onChange={(e) =>
                        editItem(item.id, { price: parseFloat(e.target.value) })
                      }
                      className="h-8 w-full"
                      disabled={isCreating}
                      aria-label="Item price"
                    />
                  </Field>
                </FieldGroup>
                <fieldset
                  disabled={isCreating}
                  className="mt-3 flex min-w-0 flex-wrap items-center gap-2"
                >
                  <legend className="sr-only">Who had {item.name}?</legend>
                  <MultiSelect
                    options={memberOptions}
                    selected={assignees}
                    onChange={(memberIds) => setItemMembers(item.id, memberIds)}
                    placeholder="Who had this?"
                    className="min-w-0 flex-1"
                  />
                  {share !== null && (
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      ${share.toFixed(2)} each
                    </span>
                  )}
                </fieldset>
              </div>
            )
          })}
        </div>

        {perBorrowerTotals.size > 0 && (
          <>
            <Separator className="my-3" />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Totals per person</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(perBorrowerTotals.entries()).map(
                  ([memberId, total]) => (
                    <Badge key={memberId} variant="secondary">
                      {memberNameById.get(memberId) || 'Unknown'}: $
                      {total.toFixed(2)}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          </>
        )}
        {unassignedCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {unassignedCount} unassigned item{unassignedCount === 1 ? '' : 's'}{' '}
            will not be included in the debts.
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 px-4 pb-4">
        <Button
          size="sm"
          onClick={() => onCreate(debts)}
          disabled={isCreating || debts.length === 0 || hasInvalidItem}
        >
          {isCreating && <Spinner />}
          {isCreating
            ? 'Creating…'
            : `Create ${debts.length} debt${debts.length > 1 ? 's' : ''}`}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isCreating}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  )
}
