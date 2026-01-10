import { getUser } from '@/lib/supabase'
import { debtService } from '@/services/debt.service'
import { redirect } from 'next/navigation'
import DebtsPageClient from './debts-client'

export default async function DebtsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all debts (not just pending)
  const debts = await debtService.getUserDebts(user.id)

  return <DebtsPageClient initialDebts={debts} currentUser={user} />
}
