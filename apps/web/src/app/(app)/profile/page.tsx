import { isPaypalConfigured } from '@/lib/paypal'
import { getUser } from '@/lib/supabase'
import { paypalService } from '@/services/paypal.service'
import { userService } from '@/services/user.service'
import { redirect } from 'next/navigation'
import ProfilePageClient from './profile-client'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ paypal?: string; reason?: string }>
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const [userData, paypalAccount, { paypal, reason }] = await Promise.all([
    userService.getUserById(user.id),
    paypalService.getAccount(user.id),
    searchParams,
  ])

  return (
    <ProfilePageClient
      user={userData}
      paypalEnabled={isPaypalConfigured()}
      paypalAccount={paypalAccount}
      paypalStatus={paypal}
      paypalReason={reason}
    />
  )
}
