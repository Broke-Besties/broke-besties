import { getUser } from '@/lib/supabase'
import { groupService } from '@/services/group.service'
import { redirect } from 'next/navigation'
import GroupsPageClient from './groups-client'

export default async function GroupsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const groups = await groupService.getUserGroups(user.id)

  return <GroupsPageClient initialGroups={groups} />
}
