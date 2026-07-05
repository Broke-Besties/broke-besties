'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update your profile details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarFallback className="text-lg">
                    {initials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>

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
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  disabled={isLoading}
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
                  User ID
                </ItemTitle>
              </ItemContent>
              <ItemActions className="font-medium tabular-nums">
                {user.id}
              </ItemActions>
            </Item>
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
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  )
}
