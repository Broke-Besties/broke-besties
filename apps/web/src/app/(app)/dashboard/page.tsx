import { getUser } from '@/lib/supabase'
import { getDashboardData } from '@/lib/dashboard-data'
import { redirect } from 'next/navigation'
import DashboardPageClient from './dashboard-client'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // ponytail: the shared loader also runs the nav-count queries, which this
  // page ignores (the layout renders the badges). Three indexed COUNTs per
  // load keep page and API on one code path; wrap getNavCounts in React
  // cache() if that ever matters.
  const data = await getDashboardData(user)

  return (
    <DashboardPageClient
      initialDebts={data.debts}
      initialGroups={data.groups}
      initialTabs={data.tabs}
      currentUser={user}
      userName={data.user.name || user.email || 'User'}
      initialRecurringPayments={data.recurringPayments}
      initialAlerts={data.alerts}
      initialPendingTransactions={data.pendingApprovals}
    />
  )
}
