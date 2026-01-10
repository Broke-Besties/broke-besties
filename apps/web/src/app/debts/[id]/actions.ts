'use server'

import { getUser } from '@/lib/supabase'
import { debtService } from '@/services/debt.service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function requestDebtDeletion(debtId: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    await debtService.requestDebtDeletion(debtId, user.id)
    revalidatePath(`/debts/${debtId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Request debt deletion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request deletion',
    }
  }
}

export async function approveDebtDeletion(debtId: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    await debtService.approveDebtDeletion(debtId, user.id)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Approve debt deletion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve deletion',
    }
  }
}

export async function cancelDebtDeletionRequest(debtId: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    await debtService.cancelDebtDeletionRequest(debtId, user.id)
    revalidatePath(`/debts/${debtId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Cancel debt deletion request error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel request',
    }
  }
}
