'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { acceptInvite, rejectInvite } from './actions'
import { InviteRow } from './invite-row'
import type { Invite, PendingInviteAction } from './types'

type InvitesPageClientProps = {
  initialInvites: Invite[]
}

export default function InvitesPageClient({
  initialInvites,
}: InvitesPageClientProps) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites)
  const [pending, setPending] = useState<PendingInviteAction | null>(null)
  const router = useRouter()

  const handleAccept = async (inviteId: number) => {
    setPending({ id: inviteId, action: 'accept' })
    try {
      const result = await acceptInvite(inviteId)
      if (!result.success) {
        toast.error(result.error || 'Failed to accept invite')
        setPending(null)
        return
      }
      toast.success('Invite accepted')
      // Keep the pending spinner while navigating into the group.
      router.push(`/groups/${result.group?.id}`)
    } catch {
      toast.error('An error occurred while accepting the invite')
      setPending(null)
    }
  }

  const handleReject = async (inviteId: number) => {
    setPending({ id: inviteId, action: 'reject' })
    try {
      const result = await rejectInvite(inviteId)
      if (!result.success) {
        toast.error(result.error || 'Failed to reject invite')
        return
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
      toast.success('Invite rejected')
    } catch {
      toast.error('An error occurred while rejecting the invite')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Group invites"
        description={
          invites.length > 0
            ? `You have ${invites.length} pending ${
                invites.length === 1 ? 'invitation' : 'invitations'
              }.`
            : 'Accept or decline invitations to join groups.'
        }
        breadcrumbs={[
          { label: 'Groups', href: '/groups' },
          { label: 'Invites' },
        ]}
      />

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
            <Button asChild>
              <Link href="/groups">View my groups</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {invites.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              pending={pending}
              onAccept={() => handleAccept(invite.id)}
              onReject={() => handleReject(invite.id)}
            />
          ))}
        </ItemGroup>
      )}
    </div>
  )
}
