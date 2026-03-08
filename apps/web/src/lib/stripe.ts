import Stripe from 'stripe';
import { prisma } from './prisma';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

/**
 * Get the lender's Stripe Connect account ID
 * Throws error if lender hasn't completed Stripe onboarding
 */
export async function getLenderStripeAccount(lenderId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: lenderId },
    select: { stripe_connect_id: true, stripe_charges_enabled: true },
  });

  if (!user?.stripe_connect_id) {
    throw new Error(`Lender ${lenderId} has not completed Stripe Connect setup`);
  }

  if (!user.stripe_charges_enabled) {
    throw new Error(`Lender ${lenderId} has not completed Stripe verification`);
  }

  return user.stripe_connect_id;
}

/**
 * Create a Stripe Checkout session for debt payment
 * Returns the session and creates a PaymentAttempt record for idempotency
 */
export async function createDebtPaymentSession(debtId: number) {
  const debt = await prisma.debt.findUnique({
    where: { id: debtId },
    include: { lender: true, borrower: true },
  });

  if (!debt) {
    throw new Error(`Debt ${debtId} not found`);
  }

  if (debt.status === 'settled') {
    throw new Error(`Debt ${debtId} is already settled`);
  }

  const stripeAccountId = await getLenderStripeAccount(debt.lenderId);

  // Create idempotency key
  const idempotencyKey = `debt_${debtId}_${Date.now()}`;
  const amount = Math.round(parseFloat(debt.amount.toString()) * 100); // Convert to cents

  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Debt Settlement${debt.description ? ': ' + debt.description : ''}`,
              description: `Payment from ${debt.borrower.name} to ${debt.lender.name}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/debts/${debtId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/debts/${debtId}/cancel`,
      metadata: {
        debtId: debtId.toString(),
        borrowerId: debt.borrowerId,
        lenderId: debt.lenderId,
      },
    },
    { stripeAccount: stripeAccountId }
  );

  // Store payment attempt for idempotency and tracking
  await prisma.paymentAttempt.create({
    data: {
      stripe_session_id: session.id,
      stripe_payment_intent_id: (session.payment_intent as string) || null,
      stripe_user_id: debt.borrowerId,
      debtId,
      idempotency_key: idempotencyKey,
      amount,
      status: 'pending',
    },
  });

  return session;
}

// ─── Subscription Plan Configuration ───────────────────────────────

export type PlanTier = 'free' | 'pro' | 'max'

export type PlanConfig = {
  id: PlanTier
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  monthlyPriceId: string
  yearlyPriceId: string
  features: string[]
  highlighted?: boolean
}

export const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with expense splitting',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyPriceId: '',
    yearlyPriceId: '',
    features: [
      'Up to 3 groups',
      'Basic expense splitting',
      'Friend management',
      'Debt tracking',
      'Email notifications',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Split smarter, save more',
    monthlyPrice: 9.99,
    yearlyPrice: 79.99,
    monthlyPriceId: 'price_1T8Z42LMTBZbWN5N2NA6TRUo',
    yearlyPriceId: 'price_1T8Z43LMTBZbWN5NaJqs7xfb',
    highlighted: true,
    features: [
      'Everything in Free, and:',
      'Unlimited groups',
      'Recurring payments',
      'Receipt scanning (AI)',
      'Priority support',
      'Advanced analytics',
      'Custom reminders',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    description: 'Ultimate expense management',
    monthlyPrice: 24.99,
    yearlyPrice: 199.99,
    monthlyPriceId: 'price_1T8Z44LMTBZbWN5NBfAT49B9',
    yearlyPriceId: 'price_1T8Z45LMTBZbWN5NNZo7OSwj',
    features: [
      'Everything in Pro, plus:',
      'AI-powered expense categorization',
      'P2P payment integration',
      'Export to accounting software',
      'Early access to new features',
      'Priority access at high traffic times',
      'Dedicated support channel',
    ],
  },
]

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return PLANS.find(
    (p) => p.monthlyPriceId === priceId || p.yearlyPriceId === priceId
  )
}

export function getPlanById(planId: PlanTier): PlanConfig | undefined {
  return PLANS.find((p) => p.id === planId)
}
