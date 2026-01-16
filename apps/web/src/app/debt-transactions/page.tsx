import { getUser } from '@/lib/supabase'
import { debtTransactionService } from '@/services/debt-transaction.service'
import { redirect } from 'next/navigation'
import DebtTransactionsClient from './debt-transactions-client'

export default async function DebtTransactionsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const transactions = await debtTransactionService.getUserPendingTransactions(user.id)

  return <DebtTransactionsClient transactions={transactions} currentUserId={user.id} />
}
