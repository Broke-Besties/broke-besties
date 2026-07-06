'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { respondToTransaction } from '../actions'

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

type PendingConfirm = {
  transaction: Transaction
  approve: boolean
}

function initials(value: string): string {
  const parts = value.split(/[\s._@-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (letters || value.slice(0, 2)).toUpperCase()
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'confirm_paid':
      return 'Payment confirmation'
    case 'modify':
      return 'Modification'
    case 'drop':
      return 'Deletion'
    default:
      return type
  }
}

export default function RequestsPageClient({
  initialTransactions,
  currentUserId,
}: RequestsPageClientProps) {
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions)
  const [activeTab, setActiveTab] = useState<'inbox' | 'waiting'>('inbox')
  const [responding, setResponding] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const router = useRouter()

  // Keep the local list in sync after router.refresh() re-fetches the page.
  useEffect(() => {
    setTransactions(initialTransactions)
  }, [initialTransactions])

  const needsMyApproval = (transaction: Transaction) => {
    const isLender = transaction.debt.lenderId === currentUserId
    const isBorrower = transaction.debt.borrowerId === currentUserId

    if (isLender && !transaction.lenderApproved) return true
    if (isBorrower && !transaction.borrowerApproved) return true
    return false
  }

  const inbox = transactions.filter(needsMyApproval)
  const waiting = transactions.filter((t) => !needsMyApproval(t))

  const respond = async (transaction: Transaction, approve: boolean) => {
    setResponding(transaction.id)
    const result = await respondToTransaction(transaction.id, approve)
    if (result.success) {
      setTransactions((prev) => prev.filter((t) => t.id !== transaction.id))
      toast.success(approve ? 'Request approved' : 'Request rejected')
      router.refresh()
    } else {
      const message =
        'error' in result && result.error
          ? result.error
          : 'Failed to respond to request'
      toast.error(message)
    }
    setResponding(null)
  }

  const handleRespond = (transaction: Transaction, approve: boolean) => {
    // Rejecting and approving a deletion are destructive — confirm first.
    if (!approve || transaction.type === 'drop') {
      setConfirm({ transaction, approve })
      return
    }
    respond(transaction, approve)
  }

  const renderEmpty = (title: string, description: string) => (
    <Empty className="rounded-lg border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <Link href="/debts">Back to debts</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )

  const renderRow = (transaction: Transaction, canRespond: boolean) => {
    const isLender = transaction.debt.lenderId === currentUserId
    const otherPerson = isLender
      ? transaction.debt.borrower
      : transaction.debt.lender
    const isRequester = transaction.requesterId === currentUserId
    const requesterName =
      transaction.requester.name || transaction.requester.email
    const otherName = otherPerson.name || otherPerson.email
    const isBusy = responding === transaction.id

    const details: string[] = [
      isRequester ? 'You requested' : `Requested by ${requesterName}`,
      `With ${otherName}`,
    ]
    if (transaction.type === 'modify' && transaction.proposedAmount !== null) {
      details.push(
        `$${transaction.debt.amount.toFixed(2)} → $${transaction.proposedAmount.toFixed(2)}`
      )
    }
    if (
      transaction.type === 'modify' &&
      transaction.proposedDescription !== null
    ) {
      details.push(`New description: ${transaction.proposedDescription || '(none)'}`)
    }
    if (transaction.reason) {
      details.push(transaction.reason)
    }

    return (
      <Item key={transaction.id} variant="outline">
        <ItemMedia>
          <Avatar>
            <AvatarFallback>{initials(requesterName)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {getTypeLabel(transaction.type)} · $
            {transaction.debt.amount.toFixed(2)}
          </ItemTitle>
          <ItemDescription>{details.join(' · ')}</ItemDescription>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <StatusBadge
              status={transaction.lenderApproved ? 'approved' : 'pending'}
              label={
                transaction.lenderApproved ? 'Lender ✓' : 'Lender pending'
              }
            />
            <StatusBadge
              status={transaction.borrowerApproved ? 'approved' : 'pending'}
              label={
                transaction.borrowerApproved ? 'Borrower ✓' : 'Borrower pending'
              }
            />
          </div>
        </ItemContent>
        <ItemActions className="flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/debts/${transaction.debtId}`}>View debt</Link>
          </Button>
          {canRespond && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRespond(transaction, false)}
                disabled={isBusy}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleRespond(transaction, true)}
                disabled={isBusy}
              >
                {isBusy && <Spinner />}
                Approve
              </Button>
            </>
          )}
        </ItemActions>
      </Item>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Debts', href: '/debts' }, { label: 'Requests' }]}
        title="Requests"
        description="Approve or reject pending changes to your debts."
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'inbox' | 'waiting')}
      >
        <TabsList>
          <TabsTrigger value="inbox">
            Needs your approval ({inbox.length})
          </TabsTrigger>
          <TabsTrigger value="waiting">
            Waiting on others ({waiting.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          {inbox.length === 0 ? (
            renderEmpty(
              'Nothing needs your approval',
              "You're all caught up! New requests from friends will land here."
            )
          ) : (
            <ItemGroup className="gap-2">
              {inbox.map((transaction) => renderRow(transaction, true))}
            </ItemGroup>
          )}
        </TabsContent>

        <TabsContent value="waiting">
          {waiting.length === 0 ? (
            renderEmpty(
              'Nothing waiting on others',
              'Requests you have approved or created will wait here for the other party.'
            )
          ) : (
            <ItemGroup className="gap-2">
              {waiting.map((transaction) => renderRow(transaction, false))}
            </ItemGroup>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.approve
                ? 'Approve this deletion?'
                : 'Reject this request?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.approve
                ? `This will permanently remove the $${confirm.transaction.debt.amount.toFixed(2)} debt. This cannot be undone.`
                : 'The request will be declined and the other party will be notified. They can submit a new request later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) {
                  respond(confirm.transaction, confirm.approve)
                }
                setConfirm(null)
              }}
            >
              {confirm?.approve ? 'Approve deletion' : 'Reject request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
