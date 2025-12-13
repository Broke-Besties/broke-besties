'use server'

import { getUser } from '@/lib/supabase'
import { inviteService } from '@/services/invite.service'
import { redirect } from 'next/navigation'

export async function getInvitesAction() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const invites = await inviteService.getUserInvites(user.email!)
    return { success: true, invites }
  } catch (error) {
    console.error('Get invites error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load invites',
    }
  }
}

export async function acceptInviteAction(inviteId: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const group = await inviteService.acceptInvite(user.id, user.email!, inviteId)
    return { success: true, group }
  } catch (error) {
    console.error('Accept invite error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept invite',
    }
  }
}

export async function createInviteAction(groupId: number, invitedEmail: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const invite = await inviteService.createInvite(user.id, groupId, invitedEmail)
    return { success: true, invite }
  } catch (error) {
    console.error('Create invite error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invite',
    }
  }
}
