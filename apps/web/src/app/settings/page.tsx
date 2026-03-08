import { getUser } from '@/lib/supabase'
import { userService } from '@/services/user.service'
import { redirect } from 'next/navigation'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const userData = await userService.getUserById(user.id)

  return <SettingsClient user={userData} />
}
