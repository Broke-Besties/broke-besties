'use server'

import { getUser } from '@/lib/supabase'
import { inviteService } from '@/services/invite.service'
import { redirect } from 'next/navigation'

export async function acceptInvite(inviteId: number) {
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
