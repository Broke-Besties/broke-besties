'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  initialInvites: any[]
}

export default function InvitesPageClient({ initialInvites }: InvitesPageClientProps) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites)
  const [error, setError] = useState('')
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const router = useRouter()

  const handleAccept = async (inviteId: number) => {
    setAcceptingId(inviteId)
    setError('')

    try {
      const result = await acceptInvite(inviteId)

      if (!result.success) {
        setError(result.error || 'Failed to accept invite')
        setAcceptingId(null)
        return
      }

      router.push(`/groups/${result.group?.id}`)
    } catch (err) {
      setError('An error occurred while accepting the invite')
      setAcceptingId(null)
    }
  }

  const handleReject = async (inviteId: number) => {
    setRejectingId(inviteId)
    setError('')

    try {
      const result = await rejectInvite(inviteId)

      if (!result.success) {
        setError(result.error || 'Failed to reject invite')
        setRejectingId(null)
        return
      }

      // Remove the rejected invite from the list
      setInvites(invites.filter(invite => invite.id !== inviteId))
    } catch (err) {
      setError('An error occurred while rejecting the invite')
    } finally {
      setRejectingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" className="w-fit px-0" onClick={() => router.push('/groups')}>
          ← Back to groups
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Invitations</h1>
          <p className="text-sm text-muted-foreground">
            You have {invites.length} pending {invites.length === 1 ? 'invitation' : 'invitations'}.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {invites.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No pending invites</CardTitle>
            <CardDescription>When someone invites you to a group, it will show up here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/groups')}>View my groups</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invites.map((invite) => (
            <Card key={invite.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{invite.group.name}</CardTitle>
                  <CardDescription>
                    Invited by <span className="font-medium text-foreground">{invite.sender.email}</span>
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {invite.group.members.length} {invite.group.members.length === 1 ? 'member' : 'members'}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Invited {new Date(invite.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleReject(invite.id)}
                    disabled={acceptingId === invite.id || rejectingId === invite.id}
                  >
                    {rejectingId === invite.id ? 'Rejecting…' : 'Reject'}
                  </Button>
                  <Button
                    onClick={() => handleAccept(invite.id)}
                    disabled={acceptingId === invite.id || rejectingId === invite.id}
                  >
                    {acceptingId === invite.id ? 'Accepting…' : 'Accept'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
