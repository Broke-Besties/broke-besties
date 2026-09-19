import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { walletService } from '@/services/wallet.service'

export async function POST(req: NextRequest) {
  let stripe: Stripe

  try {
    stripe = getStripe()
  } catch {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 500 }
    )
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  if (secret && signature) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret)
    } catch (error) {
      console.error('Stripe webhook signature verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    // Dev fallback: process unverified events when no webhook secret is set
    console.warn('STRIPE_WEBHOOK_SECRET not set - skipping signature verification')
    try {
      event = JSON.parse(body) as Stripe.Event
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await walletService.completeDeposit(session)
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        await walletService.failDeposit(session)
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
