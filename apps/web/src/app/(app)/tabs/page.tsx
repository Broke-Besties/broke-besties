import { getUser } from '@/lib/supabase'
import { tabService } from '@/services/tab.service'
import { redirect } from 'next/navigation'
import TabsPageClient from './tabs-client'

export default async function TabsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const [tabs, params] = await Promise.all([
    tabService.getUserTabs(user.id),
    searchParams,
  ])

  return (
    <TabsPageClient initialTabs={tabs} autoOpenCreate={params.new === '1'} />
  )
}
