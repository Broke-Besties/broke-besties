import { getUser } from '@/lib/supabase'
import { recurringPaymentService } from '@/services/recurring-payment.service'
import { redirect } from 'next/navigation'
import RecurringPaymentsClient from './recurring-payments-client'

export default async function RecurringPaymentsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const recurringPayments = await recurringPaymentService.getUserRecurringPayments(user.id)

  return <RecurringPaymentsClient initialRecurringPayments={recurringPayments} currentUser={user} />
}
