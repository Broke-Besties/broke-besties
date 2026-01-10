'use server'

import { getUser } from '@/lib/supabase'
import { recurringPaymentService } from '@/services/recurring-payment.service'
import { userService } from '@/services/user.service'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type CreateRecurringPaymentResult =
  | { success: true; recurringPayment: Awaited<ReturnType<typeof recurringPaymentService.createRecurringPayment>> }
  | { success: false; error: string }

export async function createRecurringPayment(data: {
  amount: number
  description?: string
  frequency: number
  borrowers: Array<{ email: string; splitPercentage: number }>
}): Promise<CreateRecurringPaymentResult> {
  const user = await getUser()
  if (!user) redirect('/login')

  try {
    // Validate percentages sum to 100
    const totalPercentage = data.borrowers.reduce((sum, b) => sum + b.splitPercentage, 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return { success: false, error: 'Split percentages must sum to 100%' }
    }

    // Look up user IDs from emails
    const borrowersWithIds = await Promise.all(
      data.borrowers.map(async (b) => {
        const borrowerUser = await prisma.user.findUnique({
          where: { email: b.email },
          select: { id: true },
        })

        if (!borrowerUser) {
          throw new Error(`User with email ${b.email} not found`)
        }

        return {
          userId: borrowerUser.id,
          splitPercentage: b.splitPercentage,
        }
      })
    )

    const recurringPayment = await recurringPaymentService.createRecurringPayment({
      amount: data.amount,
      description: data.description,
      frequency: data.frequency,
      borrowers: borrowersWithIds,
      lenderId: user.id,
    })

    revalidatePath('/recurring-payments')
    revalidatePath('/dashboard')

    return { success: true, recurringPayment }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create recurring payment',
    }
  }
}

export async function toggleRecurringPaymentStatus(id: number) {
  const user = await getUser()
  if (!user) redirect('/login')

  try {
    const payment = await recurringPaymentService.toggleStatus(id, user.id)
    revalidatePath('/recurring-payments')
    return { success: true, payment }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle status',
    }
  }
}

export async function deleteRecurringPayment(id: number) {
  const user = await getUser()
  if (!user) redirect('/login')

  try {
    await recurringPaymentService.deleteRecurringPayment(id, user.id)
    revalidatePath('/recurring-payments')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete recurring payment',
    }
  }
}

export async function searchUsers(query: string) {
  const user = await getUser()
  if (!user) redirect('/login')

  try {
    const users = await userService.searchUserByEmail(query)
    return { success: true, users }
  } catch (error) {
    console.error('Search users error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search users',
      users: [],
    }
  }
}
