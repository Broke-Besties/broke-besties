'use client'

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DebtFormItem } from '@/app/(app)/groups/[id]/debt-form-item'

export type DebtFormData = {
  amount: string
  description: string
  borrowerId: string
  borrower: { id: string; name: string; email: string } | null
  alertMessage: string
  alertDeadline: string
}

type DebtReviewPanelProps = {
  debtForms: DebtFormData[]
  currentIndex: number
  groupId: number
  currentUserId: string | undefined
  receiptId: string | null
  isCreating: boolean
  onIndexChange: (index: number) => void
  onFormChange: (index: number, data: DebtFormData) => void
  onAddDebt: () => void
  onRemoveDebt: (index: number) => void
  onCreate: () => void
  onCancel: () => void
}

export function DebtReviewPanel({
  debtForms,
  currentIndex,
  groupId,
  currentUserId,
  receiptId,
  isCreating,
  onIndexChange,
  onFormChange,
  onAddDebt,
  onRemoveDebt,
  onCreate,
  onCancel,
}: DebtReviewPanelProps) {
  const current = debtForms[currentIndex]
  if (!current) return null

  const hasInvalidDebt = debtForms.some(
    (debt) => !debt.borrowerId || !debt.amount || parseFloat(debt.amount) <= 0
  )

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-background/50 p-3 sm:p-4">
        {(debtForms.length > 1 || receiptId) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {debtForms.length > 1 && (
              <span className="text-xs font-semibold">
                Debt {currentIndex + 1} of {debtForms.length}
              </span>
            )}
            {receiptId && <Badge variant="secondary">Receipt attached</Badge>}
          </div>
        )}

        <DebtFormItem
          debtData={current}
          groupId={groupId}
          currentUserId={currentUserId}
          onChange={(data) => onFormChange(currentIndex, data)}
        />

        {debtForms.length > 1 && (
          <div className="mt-3 flex items-center justify-between rounded-md border bg-muted/30 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft />
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Debt {currentIndex + 1} of {debtForms.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onIndexChange(Math.min(debtForms.length - 1, currentIndex + 1))
              }
              disabled={currentIndex === debtForms.length - 1}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddDebt}
            className="flex-1"
          >
            <Plus />
            Add another debt
          </Button>
          {debtForms.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRemoveDebt(currentIndex)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={onCreate} disabled={isCreating || hasInvalidDebt}>
          {isCreating && <Spinner />}
          {isCreating
            ? 'Creating…'
            : `Create ${debtForms.length} debt${debtForms.length > 1 ? 's' : ''}`}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isCreating}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
