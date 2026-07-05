'use server'

import { getUser } from '@/lib/supabase'
import { userService } from '@/services/user.service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function updateProfile(data: {
  name: string
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    // Validate input
    if (!data.name || data.name.trim() === '') {
      return {
        success: false,
        error: 'Name is required',
      }
    }

    const updatedUser = await userService.updateUser(user.id, {
      name: data.name.trim(),
    })

    revalidatePath('/profile')
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error('Update profile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update profile',
    }
  }
}
