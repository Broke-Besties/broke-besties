import { Suspense } from 'react'
import { getUser } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import AIPageClient from './ai-client'

export default async function AIPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <AIPageClient />
    </Suspense>
  )
}
