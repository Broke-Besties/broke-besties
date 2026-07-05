'use server'

import { getUser } from '@/lib/supabase'
import { tabService } from '@/services/tab.service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createTab(data: {
  amount: number
  description: string
  personName: string
  status?: 'lending' | 'borrowing'
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const tab = await tabService.createTab({
      ...data,
      userId: user.id,
      status: data.status || 'borrowing',
    })
    revalidatePath('/tabs')
    return { success: true, tab }
  } catch (error) {
    console.error('Create tab error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create tab',
    }
  }
}

export async function updateTab(
  tabId: number,
  data: {
    amount?: number
    description?: string
    personName?: string
    status?: string
  }
) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const tab = await tabService.updateTab(tabId, user.id, data)
    revalidatePath('/tabs')
    return { success: true, tab }
  } catch (error) {
    console.error('Update tab error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update tab',
    }
  }
}

export async function deleteTab(tabId: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    await tabService.deleteTab(tabId, user.id)
    revalidatePath('/tabs')
    return { success: true }
  } catch (error) {
    console.error('Delete tab error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete tab',
    }
  }
}
