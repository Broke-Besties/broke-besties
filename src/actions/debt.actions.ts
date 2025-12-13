'use server'

import { getUser } from '@/lib/supabase'
import { debtService } from '@/services/debt.service'
import { redirect } from 'next/navigation'

export async function getDebtsAction(filters?: {
  type?: 'lending' | 'borrowing' | null
  groupId?: number | null
  status?: string | null
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const debts = await debtService.getUserDebts(user.id, filters || {})
    return { success: true, debts }
  } catch (error) {
    console.error('Get debts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load debts',
    }
  }
}

export async function createDebtAction(data: {
  amount: number
  description?: string
  borrowerId: string
  groupId?: number
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
    return { success: true, debt }
  } catch (error) {
    console.error('Create debt error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create debt',
    }
  }
}

export async function updateDebtStatusAction(debtId: number, status: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const debt = await debtService.updateDebt(debtId, user.id, { status })
    return { success: true, debt }
  } catch (error) {
    console.error('Update debt error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update debt',
    }
  }
}
