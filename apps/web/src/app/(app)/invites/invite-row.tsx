'use client'

import { useState } from 'react'

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
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import type { Invite, PendingInviteAction } from './types'

function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (letters || value.slice(0, 2)).toUpperCase()
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type InviteRowProps = {
  invite: Invite
  pending: PendingInviteAction | null
  onAccept: () => void
  onReject: () => void
}

export function InviteRow({
  invite,
  pending,
  onAccept,
  onReject,
}: InviteRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const accepting = pending?.action === 'accept' && pending.id === invite.id
  const rejecting = pending?.action === 'reject' && pending.id === invite.id
  const busy = accepting || rejecting
  const memberCount = invite.group.members.length

  return (
    <>
      <Item variant="outline" className="flex-wrap">
        <ItemMedia>
          {/* Groups get square avatars to distinguish them from people. */}
          <Avatar className="size-10 rounded-md">
            <AvatarFallback className="rounded-md">
              {initials(invite.group.name)}
            </AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{invite.group.name}</ItemTitle>
          <ItemDescription>
            Invited by {invite.sender.name || invite.sender.email}
          </ItemDescription>
          <span className="text-xs text-muted-foreground">
            {memberCount} {memberCount === 1 ? 'member' : 'members'} ·{' '}
            {formatDate(invite.createdAt)}
          </span>
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
          >
            {rejecting && <Spinner />}
            Reject
          </Button>
          <Button size="sm" onClick={onAccept} disabled={busy}>
            {accepting && <Spinner />}
            Accept
          </Button>
        </ItemActions>
      </Item>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject invite?</AlertDialogTitle>
            <AlertDialogDescription>
              You will decline the invitation to join {invite.group.name}. A
              member can invite you again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={onReject}
            >
              Reject invite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
