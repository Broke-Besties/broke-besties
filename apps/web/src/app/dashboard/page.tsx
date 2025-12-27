import { getUser } from '@/lib/supabase'
import { debtService } from '@/services/debt.service'
import { groupService } from '@/services/group.service'
import { redirect } from 'next/navigation'
import DashboardPageClient from './dashboard-client'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const debts = await debtService.getUserDebts(user.id)
  const groups = await groupService.getUserGroups(user.id)

  return (
    <DashboardPageClient
      initialDebts={debts}
      initialGroups={groups}
      currentUser={user}
    />
  )
}
