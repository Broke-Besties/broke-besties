import { getUser } from '@/lib/supabase'
import { debtTransactionService } from '@/services/debt-transaction.service'
import { redirect } from 'next/navigation'
import RequestsPageClient from './requests-client'

export default async function RequestsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const transactions = await debtTransactionService.getUserPendingTransactions(user.id)

  return (
    <RequestsPageClient
      initialTransactions={transactions}
      currentUserId={user.id}
    />
  )
}
