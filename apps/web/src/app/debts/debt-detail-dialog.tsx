'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Pencil, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

type DebtDetailDialogProps = {
  debt: Debt | null
  isOpen: boolean
  onClose: () => void
  currentUserId: string
  onMarkAsPaid: (debt: Debt) => void
  onModify: (debt: Debt) => void
  onDelete: (debt: Debt) => void
}

export function DebtDetailDialog({
  debt,
  isOpen,
  onClose,
  currentUserId,
  onMarkAsPaid,
  onModify,
  onDelete,
}: DebtDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('details')
  const router = useRouter()

  if (!isOpen || !debt) return null

  const isLender = debt.lender.id === currentUserId
  const direction = isLender ? 'lending' : 'borrowing'
  const otherPerson = isLender ? debt.borrower : debt.lender

  return (
    <>
      <DialogOverlay
        onClick={onClose}
        className="animate-in fade-in-0 duration-200"
      />
      <DialogContent className="max-w-md animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {direction === 'lending' ? '+' : '-'}${debt.amount.toFixed(2)}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isLender ? (
                  <>Lending to {otherPerson.name || otherPerson.email}</>
                ) : (
                  <>Borrowing from {otherPerson.name || otherPerson.email}</>
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                debt.status === 'pending' ? 'yellow-badge' : 'green-badge'
              )}>
                {debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
              </span>
              <button
                onClick={onClose}
                className="rounded-md p-1 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="actions" className="flex-1">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    direction === 'lending' ? 'green-badge' : 'red-badge'
                  )}>
                    {direction === 'lending' ? 'Lending' : 'Borrowing'}
                  </span>
                </div>

                {debt.description && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Description</Label>
                    <p className="mt-1 text-sm">{debt.description}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground text-xs">Person</Label>
                  <p className="mt-1 text-sm">{otherPerson.name || otherPerson.email}</p>
                  {otherPerson.name && (
                    <p className="text-xs text-muted-foreground">{otherPerson.email}</p>
                  )}
                </div>

                {debt.group && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Group</Label>
                    <p className="mt-1 text-sm">{debt.group.name}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground text-xs">Created</Label>
                  <p className="mt-1 text-sm">
                    {new Date(debt.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push(`/debts/${debt.id}`)}
                  >
                    View Full Details
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="actions">
              {debt.status === 'pending' ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      onClose()
                      onMarkAsPaid(debt)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green/10">
                      <CheckCircle2 className="h-5 w-5 text-green" />
                    </div>
                    <div>
                      <p className="font-medium">Mark as Paid</p>
                      <p className="text-sm text-muted-foreground">
                        Request confirmation that this debt has been settled
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onClose()
                      onModify(debt)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <Pencil className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">Modify Debt</p>
                      <p className="text-sm text-muted-foreground">
                        Request to change the amount or description
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onClose()
                      onDelete(debt)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red/10">
                      <Trash2 className="h-5 w-5 text-red" />
                    </div>
                    <div>
                      <p className="font-medium">Delete Debt</p>
                      <p className="text-sm text-muted-foreground">
                        Request to remove this debt entirely
                      </p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    This debt has been marked as paid.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No actions available.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </>
  )
}
