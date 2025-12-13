import { getDebts } from '@/actions/debt.actions'
import { getCurrentUser } from '@/actions/user.actions'
import { redirect } from 'next/navigation'
import DashboardPageClient from './dashboard-client'

export default async function DashboardPage() {
  const [debtsResult, userResult] = await Promise.all([
    getDebts(),
    getCurrentUser(),
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
