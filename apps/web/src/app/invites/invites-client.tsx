'use client'

import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
import { acceptInvite, rejectInvite } from './actions'

type Invite = {
  id: number
  group: {
    id: number
    name: string
    members: {
      user: {
        email: string
      }
    }[]
  }
  sender: {
    email: string
  }
  createdAt: Date | string
}

type InvitesPageClientProps = {
  initialInvites: Invite[]
}

function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (letters || value.slice(0, 2)).toUpperCase()
}

export default function InvitesPageClient({ initialInvites }: InvitesPageClientProps) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const router = useRouter()

  const handleAccept = async (inviteId: number) => {
    setAcceptingId(inviteId)
    try {
      const result = await acceptInvite(inviteId)
      if (!result.success) {
        toast.error(result.error || 'Failed to accept invite')
        setAcceptingId(null)
        return
      }
      router.push(`/groups/${result.group?.id}`)
    } catch {
      toast.error('An error occurred while accepting the invite')
      setAcceptingId(null)
    }
  }

  const handleReject = async (inviteId: number) => {
    setRejectingId(inviteId)
    try {
      const result = await rejectInvite(inviteId)
      if (!result.success) {
        toast.error(result.error || 'Failed to reject invite')
        setRejectingId(null)
        return
      }
      setInvites(invites.filter((invite) => invite.id !== inviteId))
    } catch {
      toast.error('An error occurred while rejecting the invite')
    } finally {
      setRejectingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit px-2"
          onClick={() => router.push('/groups')}
        >
          <ArrowLeft />
          Back to groups
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Invitations
          </h1>
          <p className="text-sm text-muted-foreground">
            You have {invites.length} pending{' '}
            {invites.length === 1 ? 'invitation' : 'invitations'}.
          </p>
        </div>
      </div>

      {invites.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Mail />
            </EmptyMedia>
            <EmptyTitle>No pending invites</EmptyTitle>
            <EmptyDescription>
              When someone invites you to a group, it will show up here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => router.push('/groups')}>View my groups</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {invites.map((invite) => (
            <Item key={invite.id} variant="outline" className="flex-wrap">
              <ItemMedia>
                <Avatar className="size-10">
                  <AvatarFallback>{initials(invite.group.name)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{invite.group.name}</ItemTitle>
                <ItemDescription>
                  Invited by {invite.sender.email}
                </ItemDescription>
                <ItemDescription>
                  {invite.group.members.length}{' '}
                  {invite.group.members.length === 1 ? 'member' : 'members'} ·{' '}
                  {new Date(invite.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReject(invite.id)}
                  disabled={acceptingId === invite.id || rejectingId === invite.id}
                >
                  {rejectingId === invite.id ? 'Rejecting…' : 'Reject'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(invite.id)}
                  disabled={acceptingId === invite.id || rejectingId === invite.id}
                >
                  {acceptingId === invite.id ? 'Accepting…' : 'Accept'}
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  )
}
