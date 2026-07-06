'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
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
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { toggleRecurringPaymentStatus, deleteRecurringPayment } from '../actions'
import { formatAmount, frequencyText, initials, namedCadence } from '../format'
import ReminderCard, { type ReminderAlert } from './reminder-card'

type RecurringPaymentBorrower = {
  id: number
  userId: string
  splitPercentage: number
  user: {
    id: string
    email: string
    name: string
  }
}

type RecurringPayment = {
  id: number
  amount: number
  description: string | null
  status: string
  frequency: number
  createdAt: Date | string
  lender: {
    id: string
    email: string
    name: string
  }
  borrowers: RecurringPaymentBorrower[]
  alert?: ReminderAlert | null
}

type RecurringDetailClientProps = {
  payment: RecurringPayment
  currentUserId: string
}

export default function RecurringDetailClient({
  payment: initialPayment,
  currentUserId,
}: RecurringDetailClientProps) {
  const [payment, setPayment] = useState<RecurringPayment>(initialPayment)
  const [togglePending, setTogglePending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const router = useRouter()

  const isLender = payment.lender.id === currentUserId

  const title = payment.description || 'Recurring payment'
  const identity = `${formatAmount(payment.amount)} ${frequencyText(payment.frequency)}`
  const cadence = namedCadence(payment.frequency)

  const handleToggleStatus = async () => {
    setTogglePending(true)

    try {
      const result = await toggleRecurringPaymentStatus(payment.id)

      if (result.success && result.payment) {
        const nextStatus = result.payment.status
        setPayment((prev) => ({ ...prev, status: nextStatus }))
        toast.success(
          nextStatus === 'active'
            ? 'Recurring payment activated'
            : 'Recurring payment deactivated'
        )
      } else {
        toast.error(
          ('error' in result && result.error) || 'Failed to update status'
        )
      }
    } catch {
      toast.error('An error occurred while updating the status')
    } finally {
      setTogglePending(false)
    }
  }

  const handleDelete = async () => {
    setDeletePending(true)

    try {
      const result = await deleteRecurringPayment(payment.id)

      if (result.success) {
        toast.success('Recurring payment deleted')
        router.push('/recurring-payments')
      } else {
        toast.error(result.error || 'Failed to delete recurring payment')
        setDeleteOpen(false)
      }
    } catch {
      toast.error('An error occurred while deleting the payment')
      setDeleteOpen(false)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <PageHeader
          breadcrumbs={[
            { label: 'Recurring payments', href: '/recurring-payments' },
            { label: payment.description || identity },
          ]}
          title={title}
          actions={
            isLender ? (
              <>
                <Button
                  variant="outline"
                  disabled={togglePending}
                  onClick={handleToggleStatus}
                >
                  {togglePending && <Spinner />}
                  {payment.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More actions">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteOpen(true)}
                    >
                      Delete recurring payment
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{identity}</span>
          {cadence && (
            <>
              <span aria-hidden="true">·</span>
              <span>{cadence}</span>
            </>
          )}
          <StatusBadge status={payment.status} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Amount</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {formatAmount(payment.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Frequency</dt>
                  <dd className="mt-1 text-sm font-medium">
                    Every {payment.frequency} day
                    {payment.frequency === 1 ? '' : 's'}
                    {cadence && (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        ({cadence})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Lender</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                    {payment.lender.name || payment.lender.email}
                    {isLender && <Badge variant="secondary">You</Badge>}
                  </dd>
                  <dd className="text-sm text-muted-foreground">
                    {payment.lender.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Borrowers &amp; splits</CardTitle>
              <CardDescription>
                {payment.borrowers.length} borrower
                {payment.borrowers.length === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {payment.borrowers.map((borrower, index) => {
                  const dollarAmount =
                    (borrower.splitPercentage / 100) * payment.amount
                  const isCurrentUser = borrower.userId === currentUserId
                  const displayName = borrower.user.name || borrower.user.email

                  return (
                    <Fragment key={borrower.id}>
                      {index > 0 && <ItemSeparator />}
                      <Item size="sm" className="px-0">
                        <ItemMedia>
                          <Avatar>
                            <AvatarFallback>{initials(displayName)}</AvatarFallback>
                          </Avatar>
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            {displayName}
                            {isCurrentUser && (
                              <Badge variant="secondary">You</Badge>
                            )}
                          </ItemTitle>
                          <ItemDescription>{borrower.user.email}</ItemDescription>
                        </ItemContent>
                        <ItemActions className="flex-col items-end gap-0.5">
                          <span className="text-sm font-medium tabular-nums">
                            {borrower.splitPercentage}%
                          </span>
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {formatAmount(dollarAmount)}
                          </span>
                        </ItemActions>
                      </Item>
                    </Fragment>
                  )
                })}
              </ItemGroup>
            </CardContent>
          </Card>
        </div>

        <ReminderCard
          paymentId={payment.id}
          alert={payment.alert ?? null}
          isLender={isLender}
        />
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recurring payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes &quot;{title}&quot; ({identity}) for
              everyone involved. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deletePending}
            >
              {deletePending && <Spinner />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
