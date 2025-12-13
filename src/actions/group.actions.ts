'use server'

import { getUser } from '@/lib/supabase'
import { groupService } from '@/services/group.service'
import { redirect } from 'next/navigation'

export async function getGroupsAction() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const groups = await groupService.getUserGroups(user.id)
    return { success: true, groups }
  } catch (error) {
    console.error('Get groups error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load groups',
    }
  }
}

export async function createGroupAction(name: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const group = await groupService.createGroup(user.id, name)
    return { success: true, group }
  } catch (error) {
    console.error('Create group error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create group',
    }
  }
}

export async function getGroupByIdAction(groupId: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const group = await groupService.getGroupById(groupId, user.id)
    return { success: true, group }
  } catch (error) {
    console.error('Get group error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load group',
    }
  }
}
