'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
  createdAt: string
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchInvites()
  }, [])

  const fetchInvites = async () => {
    try {
      const response = await fetch('/api/invites')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setError(data.error || 'Failed to load invites')
        return
      }

      setInvites(data.invites)
    } catch (err) {
      setError('An error occurred while loading invites')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (inviteId: number) => {
    setProcessingId(inviteId)
    setError('')

    try {
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to accept invite')
        return
      }

      fetchInvites()
      router.push(`/groups/${data.group.id}`)
    } catch (err) {
      setError('An error occurred while accepting the invite')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
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
                  Invited {new Date(invite.createdAt).toLocaleDateString()}
                </div>
                <Button
                  onClick={() => handleAccept(invite.id)}
                  disabled={processingId === invite.id}
                >
                  {processingId === invite.id ? 'Accepting…' : 'Accept invite'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
