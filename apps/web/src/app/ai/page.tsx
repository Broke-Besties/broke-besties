import { Suspense } from 'react'
import { getUser } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import AIPageClient from './ai-client'

export default async function AIPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AIPageClient user={user} />
    </Suspense>
  )
}
