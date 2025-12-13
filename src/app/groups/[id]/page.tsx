import { getUser } from '@/lib/supabase'
import { groupService } from '@/services/group.service'
import { debtService } from '@/services/debt.service'
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

  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  try {
    const [group, debts] = await Promise.all([
      groupService.getGroupById(groupId, user.id),
      debtService.getUserDebts(user.id, { groupId }),
    ])

    return (
      <GroupDetailPageClient
        initialGroup={group}
        initialDebts={debts}
        currentUser={user}
        groupId={groupId}
      />
    )
  } catch (error) {
    console.error('Group detail error:', error)
    redirect('/groups')
  }
}
