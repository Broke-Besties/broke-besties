import { getUser } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { debtService } from '@/services/debt.service'
import { groupService } from '@/services/group.service'
import { tabService } from '@/services/tab.service'
import { recurringPaymentService } from '@/services/recurring-payment.service'
import { alertService } from '@/services/alert.service'
import { debtTransactionService } from '@/services/debt-transaction.service'
import { redirect } from 'next/navigation'
import DashboardPageClient from './dashboard-client'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const [debts, groups, tabs, dbUser, recurringPayments, alerts, pendingTransactions] = await Promise.all([
    debtService.getUserDebts(user.id, { status: 'pending' }),
    groupService.getUserGroups(user.id),
    tabService.getUserTabs(user.id, { status: 'borrowing' }),
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    recurringPaymentService.getUserRecurringPayments(user.id, { status: 'active' }),
    alertService.getActiveAlertsForBorrower(user.id),
    debtTransactionService.getUserPendingTransactions(user.id),
  ])

  // Filter pending transactions where current user is the lender (needs to approve)
  const pendingApprovals = pendingTransactions.filter(
    (transaction) => transaction.debt.lenderId === user.id && !transaction.lenderApproved
  )

  return (
    <DashboardPageClient
      initialDebts={debts}
      initialGroups={groups}
      initialTabs={tabs}
      currentUser={user}
      userName={dbUser?.name || user.email || 'User'}
      initialRecurringPayments={recurringPayments}
      initialAlerts={alerts}
      initialPendingTransactions={pendingApprovals}
    />
  )
}
