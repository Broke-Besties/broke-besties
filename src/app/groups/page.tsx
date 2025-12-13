import { getGroups } from '@/actions/group.actions'
import { redirect } from 'next/navigation'
import GroupsPageClient from './groups-client'

export default async function GroupsPage() {
  const result = await getGroups()

  if (!result.success) {
    redirect('/login')
  }

  return <GroupsPageClient initialGroups={result.groups || []} />
}
