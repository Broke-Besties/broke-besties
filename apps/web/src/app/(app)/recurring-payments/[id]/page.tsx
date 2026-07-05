import { getUser } from '@/lib/supabase'
import { recurringPaymentService } from '@/services/recurring-payment.service'
import { redirect } from 'next/navigation'
import RecurringDetailClient from './recurring-detail-client'

export default async function RecurringPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const paymentId = parseInt(id, 10)

  if (isNaN(paymentId)) {
    redirect('/recurring-payments')
  }

  const payment = await recurringPaymentService.getRecurringPaymentById(paymentId, user.id)

  return <RecurringDetailClient payment={payment} currentUserId={user.id} />
}
