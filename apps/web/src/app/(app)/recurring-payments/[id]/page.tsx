import { getUser } from '@/lib/supabase'
import { recurringPaymentService } from '@/services/recurring-payment.service'
import { notFound, redirect } from 'next/navigation'
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
    notFound()
  }

  let payment: Awaited<
    ReturnType<typeof recurringPaymentService.getRecurringPaymentById>
  >
  try {
    payment = await recurringPaymentService.getRecurringPaymentById(paymentId, user.id)
  } catch {
    // Missing id or no permission — render the designed 404 instead of crashing.
    notFound()
  }

  return <RecurringDetailClient payment={payment} currentUserId={user.id} />
}
