'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/supabase'
import { walletService } from '@/services/wallet.service'

export async function createDeposit(amountCents: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const session = await walletService.createDepositCheckout({
      userId: user.id,
      amountCents,
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    })
    return { success: true, url: session.url }
  } catch (error) {
    console.error('Create deposit error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start deposit',
    }
  }
}

export async function withdraw(amountCents: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const walletTransaction = await walletService.createWithdrawal({
      userId: user.id,
      amountCents,
    })
    revalidatePath('/wallet')
    return { success: true, walletTransaction }
  } catch (error) {
    console.error('Withdraw error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to withdraw',
    }
  }
}
