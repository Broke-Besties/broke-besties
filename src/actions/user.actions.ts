'use server'

import { getUser } from '@/lib/supabase'
import { userService } from '@/services/user.service'
import { redirect } from 'next/navigation'

export async function getCurrentUserAction() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const userData = await userService.getUserById(user.id)
    return { success: true, user: userData }
  } catch (error) {
    console.error('Get user error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load user',
    }
  }
}

export async function searchUserByEmailAction(email: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const foundUser = await userService.searchUserByEmail(email)
    return { success: true, user: foundUser }
  } catch (error) {
    console.error('Search user error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'User not found',
    }
  }
}
