'use server'

import { getUser } from '@/lib/supabase'
import { debtService } from '@/services/debt.service'
import { tabService } from '@/services/tab.service'
import { userService } from '@/services/user.service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createDebt(data: {
  amount: number
  description?: string
  borrowerId: string
  groupId: number
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const debt = await debtService.createDebt({
      amount: data.amount,
      description: data.description,
      lenderId: user.id,
      borrowerId: data.borrowerId,
      groupId: data.groupId,
    })
    revalidatePath('/dashboard')
    return { success: true, debt }
  } catch (error) {
    console.error('Create debt error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create debt',
    }
  }
}

export async function updateDebtStatus(debtId: number, status: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const debt = await debtService.updateDebt(debtId, user.id, { status })
    revalidatePath('/dashboard')
    return { success: true, debt }
  } catch (error) {
    console.error('Update debt error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update debt',
    }
  }
}

export async function searchUserByEmail(email: string) {
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

export async function updateTabStatus(tabId: number, status: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const tab = await tabService.updateTab(tabId, user.id, { status })
    revalidatePath('/dashboard')
    return { success: true, tab }
  } catch (error) {
    console.error('Update tab error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update tab',
    }
  }
}
