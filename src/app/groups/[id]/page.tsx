import { getGroup } from '@/actions/group.actions'
import { getDebts } from '@/actions/debt.actions'
import { getCurrentUser } from '@/actions/user.actions'
import { redirect } from 'next/navigation'
import GroupDetailPageClient from './group-detail-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params
  const groupId = parseInt(id)

  if (isNaN(groupId)) {
    redirect('/groups')
  }

  const [groupResult, debtsResult, userResult] = await Promise.all([
    getGroup(groupId),
    getDebts({ groupId }),
    getCurrentUser(),
  ])

  if (!groupResult.success || !userResult.success || !userResult.user) {
    redirect('/login')
  }

  if (!groupResult.group) {
    redirect('/groups')
  }

  return (
    <GroupDetailPageClient
      initialGroup={groupResult.group}
      initialDebts={debtsResult.debts || []}
      currentUser={userResult.user}
      groupId={groupId}
    />
  )
}
