import { getDebtsAction } from '@/actions/debt.actions'
import { getCurrentUserAction } from '@/actions/user.actions'
import { redirect } from 'next/navigation'
import DashboardPageClient from './dashboard-client'

export default async function DashboardPage() {
  const [debtsResult, userResult] = await Promise.all([
    getDebtsAction(),
    getCurrentUserAction(),
  ])

  if (!debtsResult.success || !userResult.success || !userResult.user) {
    redirect('/login')
  }

  return (
    <DashboardPageClient
      initialDebts={debtsResult.debts || []}
      currentUser={userResult.user}
    />
  )
}
