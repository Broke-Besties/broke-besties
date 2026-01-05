import { getUser } from '@/lib/supabase'
import { tabService } from '@/services/tab.service'
import { redirect } from 'next/navigation'
import TabsPageClient from './tabs-client'

export default async function TabsPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const tabs = await tabService.getUserTabs(user.id)

  return <TabsPageClient initialTabs={tabs} />
}
