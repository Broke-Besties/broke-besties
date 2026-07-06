import { getUser } from '@/lib/supabase'
import { groupService } from '@/services/group.service'
import { inviteService } from '@/services/invite.service'
import { redirect } from 'next/navigation'
import GroupsPageClient from './groups-client'

type PageProps = {
  searchParams: Promise<{ new?: string }>
}

export default async function GroupsPage({ searchParams }: PageProps) {
  const user = await getUser()

  if (!user || !user.email) {
    redirect('/login')
  }

  const [groups, invites, params] = await Promise.all([
    groupService.getUserGroups(user.id),
    inviteService.getUserInvites(user.email),
    searchParams,
  ])

  return (
    <GroupsPageClient
      initialGroups={groups}
      pendingInviteCount={invites.length}
      autoOpenCreate={params.new === '1'}
    />
  )
}
