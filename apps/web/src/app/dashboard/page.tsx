import { getUser } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { debtService } from '@/services/debt.service'
import { groupService } from '@/services/group.service'
import { tabService } from '@/services/tab.service'
import { recurringPaymentService } from '@/services/recurring-payment.service'
import { redirect } from 'next/navigation'
import DashboardPageClient from './dashboard-client'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const [debts, groups, tabs, dbUser, recurringPayments] = await Promise.all([
    debtService.getUserDebts(user.id, { status: 'pending' }),
    groupService.getUserGroups(user.id),
    tabService.getUserTabs(user.id, { status: 'borrowing' }),
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    recurringPaymentService.getUserRecurringPayments(user.id, { status: 'active' }),
  ])

  return (
    <DashboardPageClient
      initialDebts={debts}
      initialGroups={groups}
      initialTabs={tabs}
      currentUser={user}
      userName={dbUser?.name || user.email || 'User'}
      initialRecurringPayments={recurringPayments}
    />
  )
}
