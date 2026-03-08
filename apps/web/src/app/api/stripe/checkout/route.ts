import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase'
import { subscriptionService } from '@/services/subscription.service'
import { userService } from '@/services/user.service'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId } = await request.json()

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
    }

    const userData = await userService.getUserById(user.id)
    const url = await subscriptionService.createCheckoutSession(
      user.id,
      userData.email,
      priceId
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
