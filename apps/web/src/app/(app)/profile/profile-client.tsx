'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { updateProfile } from './actions'

type User = {
  id: string
  name: string
  email: string
  createdAt: Date | string
  updatedAt: Date | string
}

type ProfilePageClientProps = {
  user: User
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

export default function ProfilePageClient({ user }: ProfilePageClientProps) {
  const [name, setName] = useState(user.name)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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
