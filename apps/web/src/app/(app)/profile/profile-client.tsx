'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, LogOut } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { PageHeader } from '@/components/page-header'
import { logoutAction } from '@/components/actions'
import type { PaypalAccountInfo } from '@/services/paypal.service'
import { updateProfile } from './actions'
import { paypalConnectError } from './paypal-messages'

type User = {
  id: string
  name: string
  email: string
  createdAt: Date | string
  updatedAt: Date | string
}

type ProfilePageClientProps = {
  user: User
  paypalAccount: PaypalAccountInfo | null
  paypalStatus?: string
  paypalReason?: string
}

function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (letters || value.slice(0, 2)).toUpperCase()
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

export default function ProfilePageClient({
  user,
  paypalAccount,
  paypalStatus,
  paypalReason,
}: ProfilePageClientProps) {
  const [name, setName] = useState(user.name)
  const [isLoading, setIsLoading] = useState(false)
  const [paypalPending, setPaypalPending] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const paypalFeedbackShown = useRef(false)
  const router = useRouter()

  // ?paypal=connected|error comes back from the PayPal OAuth callback. The ref
  // keeps StrictMode's double effect run in dev from toasting twice.
  useEffect(() => {
    if (paypalFeedbackShown.current) return
    if (paypalStatus === 'connected') toast.success('PayPal connected')
    else if (paypalStatus === 'error') toast.error(paypalConnectError(paypalReason))
    else return
    paypalFeedbackShown.current = true
    router.replace('/profile')
  }, [paypalStatus, paypalReason, router])

  const isDirty = name.trim() !== user.name

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await updateProfile({ name })
      if (!result.success) {
        toast.error(result.error || 'Failed to update profile')
        return
      }
      toast.success('Profile updated')
      router.refresh()
    } catch {
      toast.error('An error occurred while updating your profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard.writeText(user.id)
      toast.success('Copied')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleConnectPaypal = async () => {
    setPaypalPending(true)
    try {
      const response = await fetch('/api/paypal/connect?platform=web')
      const data = await response.json()
      if (response.ok && data.url) {
        window.location.assign(data.url)
      } else {
        toast.error(data.error || paypalConnectError())
      }
    } catch {
      toast.error(paypalConnectError())
    } finally {
      // ponytail: also clears once the redirect starts, so a bfcache Back from
      // PayPal can't restore a stuck spinner (a second click just refetches the
      // URL). Keep it busy + reset on `pageshow` if the brief re-enable matters.
      setPaypalPending(false)
    }
  }

  const handleDisconnectPaypal = async () => {
    setPaypalPending(true)
    try {
      const response = await fetch('/api/paypal/account', { method: 'DELETE' })
      if (response.ok) {
        toast.success('PayPal disconnected')
        router.refresh()
      } else {
        toast.error(
          (await response.json()).error ||
            "Couldn't disconnect PayPal. Try again."
        )
      }
    } catch {
      toast.error("Couldn't disconnect PayPal. Try again.")
    } finally {
      setPaypalPending(false)
      setConfirmDisconnect(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your account settings." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update your profile details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Avatar className="size-14">
                <AvatarFallback className="text-lg">
                  {initials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>

              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  disabled={isLoading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                />
                <FieldDescription>Email cannot be changed.</FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <Button
                  type="submit"
                  disabled={isLoading || !isDirty || name.trim() === ''}
                >
                  {isLoading && <Spinner />}
                  {isLoading ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setName(user.name)}
                  disabled={isLoading || !isDirty}
                >
                  Cancel
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account information</CardTitle>
          <CardDescription>View your account details.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="font-normal text-muted-foreground">
                  Member since
                </ItemTitle>
              </ItemContent>
              <ItemActions className="font-medium">
                {formatDate(user.createdAt)}
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="font-normal text-muted-foreground">
                  Last updated
                </ItemTitle>
              </ItemContent>
              <ItemActions className="font-medium">
                {formatDate(user.updatedAt)}
              </ItemActions>
            </Item>
            <Item size="sm">
              <ItemContent>
                <ItemTitle className="font-normal text-muted-foreground">
                  User ID
                </ItemTitle>
              </ItemContent>
              <ItemActions className="min-w-0">
                <span className="truncate font-medium tabular-nums">
                  {user.id}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopyUserId}
                  aria-label="Copy user ID"
                >
                  <Copy />
                </Button>
              </ItemActions>
            </Item>
          </ItemGroup>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>PayPal</CardTitle>
          {paypalAccount ? (
            <div className="flex flex-wrap items-center gap-2">
              <CardDescription className="min-w-0 break-words">
                Connected as {paypalAccount.email}
              </CardDescription>
              {paypalAccount.emailVerified && (
                <Badge variant="secondary">Verified</Badge>
              )}
            </div>
          ) : (
            <CardDescription>
              Connect PayPal so friends can pay you back in one tap.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {paypalAccount ? (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDisconnect(true)}
            >
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnectPaypal} disabled={paypalPending}>
              {paypalPending && <Spinner />}
              Connect PayPal
            </Button>
          )}
        </CardContent>

        <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect PayPal?</AlertDialogTitle>
              <AlertDialogDescription>
                Friends won&apos;t be able to pay you with PayPal until you
                connect again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={paypalPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={paypalPending}
                onClick={(e) => {
                  e.preventDefault()
                  handleDisconnectPaypal()
                }}
              >
                {paypalPending && <Spinner />}
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Log out</CardTitle>
          <CardDescription>
            Sign out of your account on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              className="text-destructive hover:text-destructive"
            >
              <LogOut />
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
