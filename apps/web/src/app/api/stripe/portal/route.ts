import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { subscriptionService } from '@/services/subscription.service'

export async function POST() {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = await subscriptionService.createPortalSession(user.id)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
