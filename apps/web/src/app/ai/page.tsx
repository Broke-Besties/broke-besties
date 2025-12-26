import { getUser } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import AIPageClient from './ai-client'

export default async function AIPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return <AIPageClient user={user} />
}
