import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

export type WalletWithTransactions = Awaited<
  ReturnType<WalletService['getWalletWithTransactions']>
>

/** Stripe requires checkout amounts to be at least $0.50 */
export const MIN_TRANSACTION_CENTS = 50

export class WalletService {
  /**
   * Get a user's wallet, creating it if it doesn't exist
   */
  async getWallet(userId: string) {
    return prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })
  }

  /**
   * Get a user's wallet with recent transactions
   */
  async getWalletWithTransactions(userId: string) {
    const wallet = await this.getWallet(userId)

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return { wallet, transactions }
  }

  /**
   * Create a Stripe Checkout Session for a deposit.
   * The wallet is credited by the webhook (or success-page sync) when the
   * payment completes.
   */
  async createDepositCheckout(params: {
    userId: string
    amountCents: number
    origin: string
  }) {
    const { userId, amountCents, origin } = params

    if (!Number.isInteger(amountCents) || amountCents < MIN_TRANSACTION_CENTS) {
      throw new Error('Minimum deposit amount is $0.50')
    }

    const wallet = await this.getWallet(userId)

    const walletTransaction = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'deposit',
        status: 'pending',
        amountCents,
      },
    })

    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: 'BrokeBesties wallet deposit',
            },
          },
        },
      ],
      metadata: {
        userId,
        walletTransactionId: walletTransaction.id,
      },
      success_url: `${origin}/wallet?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/wallet?deposit=cancelled`,
    })

    await prisma.walletTransaction.update({
      where: { id: walletTransaction.id },
      data: { stripeRef: session.id },
    })

    return session
  }

  /**
   * Mark a deposit complete and credit the wallet balance. Idempotent.
   */
  async completeDeposit(session: Stripe.Checkout.Session) {
    const walletTransactionId = session.metadata?.walletTransactionId

    if (!walletTransactionId) {
      throw new Error('Missing walletTransactionId in session metadata')
    }

    const walletTransaction = await prisma.walletTransaction.findUnique({
      where: { id: walletTransactionId },
    })

    if (!walletTransaction) {
      throw new Error('Deposit transaction not found')
    }

    if (walletTransaction.status !== 'pending') {
      // Already processed (webhook + success-page sync can race)
      return walletTransaction
    }

    await prisma.$transaction([
      prisma.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: { status: 'completed', stripeRef: session.id },
      }),
      prisma.wallet.update({
        where: { id: walletTransaction.walletId },
        data: { balanceCents: { increment: walletTransaction.amountCents } },
      }),
    ])

    return prisma.walletTransaction.findUnique({
      where: { id: walletTransaction.id },
    })
  }

  /**
   * Mark a deposit as failed (e.g. session expired). Idempotent.
   */
  async failDeposit(session: Stripe.Checkout.Session) {
    const walletTransactionId = session.metadata?.walletTransactionId

    if (!walletTransactionId) {
      throw new Error('Missing walletTransactionId in session metadata')
    }

    await prisma.walletTransaction.updateMany({
      where: { id: walletTransactionId, status: 'pending' },
      data: { status: 'failed' },
    })
  }

  /**
   * Check a deposit session after the user is redirected back from Stripe
   * Checkout and credit the wallet if the payment succeeded. This makes
   * deposits work even when no webhook listener is configured (e.g. local dev).
   */
  async syncDeposit(sessionId: string) {
    const stripe = getStripe()

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.payment_status === 'paid') {
        await this.completeDeposit(session)
      }
    } catch (error) {
      console.error('Failed to sync deposit session:', error)
    }
  }

  /**
   * Withdraw funds from the wallet via a Stripe transfer to the user's
   * connected Stripe account. Debits the balance only if the transfer succeeds.
   */
  async createWithdrawal(params: { userId: string; amountCents: number }) {
    const { userId, amountCents } = params

    if (!Number.isInteger(amountCents) || amountCents < MIN_TRANSACTION_CENTS) {
      throw new Error('Minimum withdrawal amount is $0.50')
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    })

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    if (wallet.balanceCents < amountCents) {
      throw new Error('Insufficient funds')
    }

    const stripe = getStripe()
    const accountId = await this.ensureStripeAccount(userId)

    return prisma.$transaction(async (tx) => {
      // Conditional update guards against concurrent withdrawals overdrawing
      await tx.wallet.update({
        where: { id: wallet.id, balanceCents: { gte: amountCents } },
        data: { balanceCents: { decrement: amountCents } },
      })

      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: accountId,
        metadata: { userId },
      })

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'withdraw',
          status: 'completed',
          amountCents,
          stripeRef: transfer.id,
        },
      })
    })
  }

  /**
   * Create the user's connected Stripe account if it doesn't exist yet.
   * Uses a controller account (requirement collection handled by the
   * platform) so no hosted onboarding is needed.
   */
  private async ensureStripeAccount(userId: string) {
    const wallet = await this.getWallet(userId)

    if (wallet.stripeAccountId) {
      return wallet.stripeAccountId
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const stripe = getStripe()

    const account = await stripe.accounts.create({
      email: user.email,
      country: 'US',
      default_currency: 'usd',
      controller: {
        fees: { payer: 'application' },
        losses: { payments: 'application' },
        requirement_collection: 'application',
        stripe_dashboard: { type: 'none' },
      },
    })

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { stripeAccountId: account.id },
    })

    return account.id
  }
}

export const walletService = new WalletService()
