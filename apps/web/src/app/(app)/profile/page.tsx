import { getUser } from '@/lib/supabase'
import { userService } from '@/services/user.service'
import { redirect } from 'next/navigation'
import ProfilePageClient from './profile-client'

export default async function ProfilePage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const userData = await userService.getUserById(user.id)

  return <ProfilePageClient user={userData} />
}
