'use server'

import { getUser } from '@/lib/supabase'
import { debtService } from '@/services/debt.service'
import { friendService } from '@/services/friend.service'
import { debtTransactionService } from '@/services/debt-transaction.service'
import { groupService } from '@/services/group.service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createStandaloneDebt(data: {
  amount: number
  description?: string
  borrowerId: string
  groupId?: number
  receiptIds?: string[]
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
      groupId: data.groupId || null,
      receiptIds: data.receiptIds,
    })
    revalidatePath('/debts')
    revalidatePath('/dashboard')
    if (data.groupId) {
      revalidatePath(`/groups/${data.groupId}`)
    }
    return { success: true, debt }
  } catch (error) {
    console.error('Create debt error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create debt',
    }
  }
}

export async function getUserGroups() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const groups = await groupService.getUserGroups(user.id)
    return {
      success: true,
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
      })),
    }
  } catch (error) {
    console.error('Get groups error:', error)
    return { success: false, groups: [] }
  }
}

export async function searchFriendsForDebt(query: string) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const friends = await friendService.searchFriends(user.id, query)
    return {
      success: true,
      friends: friends.map(f => ({
        id: f.friend.id,
        name: f.friend.name,
        email: f.friend.email,
      })),
    }
  } catch (error) {
    console.error('Search friends error:', error)
    return { success: false, friends: [] }
  }
}

export async function getRecentFriendsForDebt() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const friends = await friendService.getRecentFriends(user.id, 5)
    return {
      success: true,
      friends: friends.map(f => ({
        id: f.friend.id,
        name: f.friend.name,
        email: f.friend.email,
      })),
    }
  } catch (error) {
    console.error('Get recent friends error:', error)
    return { success: false, friends: [] }
  }
}

export async function createConfirmPaidTransaction(debtId: number) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const transaction = await debtTransactionService.createTransaction({
      debtId,
      type: 'confirm_paid',
      requesterId: user.id,
    })
    revalidatePath('/debts')
    revalidatePath('/dashboard')
    revalidatePath(`/debts/${debtId}`)
    return { success: true, transaction }
  } catch (error) {
    console.error('Create confirm_paid transaction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create confirmation request',
    }
  }
}

export async function getPendingTransactions() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const transactions = await debtTransactionService.getUserPendingTransactions(user.id)
    return { success: true, transactions, userId: user.id }
  } catch (error) {
    console.error('Get pending transactions error:', error)
    return { success: false, transactions: [], userId: '' }
  }
}

export async function respondToTransaction(transactionId: number, approve: boolean) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const result = await debtTransactionService.respondToTransaction({
      transactionId,
      userId: user.id,
      approve,
    })
    revalidatePath('/debts')
    revalidatePath('/dashboard')
    return { success: true, ...result }
  } catch (error) {
    console.error('Respond to transaction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to respond to transaction',
    }
  }
}
