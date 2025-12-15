'use server'

import { getUser } from '@/lib/supabase'
import { groupService } from '@/services/group.service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createGroup(name: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const group = await groupService.createGroup(user.id, name)
    revalidatePath('/groups')
    return { success: true, group }
  } catch (error) {
    console.error('Create group error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create group',
    }
  }
}
