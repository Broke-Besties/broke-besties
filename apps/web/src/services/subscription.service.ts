import { prisma } from '@/lib/prisma'
import { stripe, getPlanByPriceId, PlanTier } from '@/lib/stripe'
import Stripe from 'stripe'

export class SubscriptionService {
  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const existing = await prisma.subscription.findUnique({
      where: { userId },
    })

    if (existing?.stripeCustomerId) {
      return existing.stripeCustomerId
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    })

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customer.id,
        plan: 'free',
        status: 'active',
      },
      update: {
        stripeCustomerId: customer.id,
      },
    })

    return customer.id
  }

  /**
   * Create a Stripe Checkout session for subscribing
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string
  ): Promise<string> {
    const customerId = await this.getOrCreateCustomer(userId, email)

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=subscription&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=subscription&canceled=true`,
      metadata: { userId },
    })

    return session.url!
  }

  /**
   * Create a Stripe Customer Portal session
   */
  async createPortalSession(userId: string): Promise<string> {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
    })

    if (!sub?.stripeCustomerId) {
      throw new Error('No Stripe customer found')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=subscription`,
    })

    return session.url
  }

  /**
   * Get user subscription from DB
   */
  async getUserSubscription(userId: string) {
    return prisma.subscription.findUnique({
      where: { userId },
    })
  }

  /**
   * Sync subscription data from Stripe webhook event
   */
  async syncSubscription(stripeSubscription: Stripe.Subscription) {
    const customerId = stripeSubscription.customer as string

    const existing = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    })

    if (!existing) {
      console.error('No subscription record found for customer:', customerId)
      return
    }

    const subscriptionItem = stripeSubscription.items.data[0]
    const priceId = subscriptionItem?.price.id
    const plan = getPlanByPriceId(priceId)

    const periodStart = (subscriptionItem as unknown as Record<string, unknown>)?.current_period_start as number | undefined
    const periodEnd = (subscriptionItem as unknown as Record<string, unknown>)?.current_period_end as number | undefined

    await prisma.subscription.update({
      where: { userId: existing.userId },
      data: {
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        plan: (plan?.id || 'pro') as PlanTier,
        status: stripeSubscription.status === 'active' ? 'active' : stripeSubscription.status === 'canceled' ? 'canceled' : 'past_due',
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    })
  }

  /**
   * Handle subscription deletion
   */
  async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
    const customerId = stripeSubscription.customer as string

    const existing = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    })

    if (!existing) return

    await prisma.subscription.update({
      where: { userId: existing.userId },
      data: {
        plan: 'free',
        status: 'canceled',
        stripeSubscriptionId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
      },
    })
  }
}

export const subscriptionService = new SubscriptionService()
