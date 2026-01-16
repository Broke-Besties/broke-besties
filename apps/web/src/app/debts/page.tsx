import { getUser } from '@/lib/supabase'
import { debtService } from '@/services/debt.service'
import { debtTransactionService } from '@/services/debt-transaction.service'
import { redirect } from 'next/navigation'
import DebtsPageClient from './debts-client'

export default async function DebtsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all debts and pending transaction count
  const [debts, pendingTransactionsCount] = await Promise.all([
    debtService.getUserDebts(user.id),
    debtTransactionService.getPendingCountForUser(user.id),
  ])

  return (
    <DebtsPageClient
      initialDebts={debts}
      currentUser={user}
      pendingTransactionsCount={pendingTransactionsCount}
    />
  )
}
