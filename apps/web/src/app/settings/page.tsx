import { getUser } from '@/lib/supabase'
import { userService } from '@/services/user.service'
import { subscriptionService } from '@/services/subscription.service'
import { redirect } from 'next/navigation'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const userData = await userService.getUserById(user.id)

  // Fetch subscription data (may be null for new users)
  let subscription = null
  try {
    const sub = await subscriptionService.getUserSubscription(user.id)
    if (sub) {
      subscription = {
        plan: sub.plan,
        status: sub.status,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      }
    }
  } catch {
    // Subscription table might not exist yet if migration hasn't run
  }

  return <SettingsClient user={userData} subscription={subscription} />
}
