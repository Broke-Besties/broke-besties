'use client'

import { useState } from 'react'
import { PLANS, PlanConfig } from '@/lib/stripe'
import { Check, Sparkles, Zap, Crown, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type SubscriptionData = {
  plan: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
} | null

type SubscriptionSectionProps = {
  subscription: SubscriptionData
}

export function SubscriptionSection({ subscription }: SubscriptionSectionProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const currentPlan = subscription?.plan || 'free'
  const isActive = subscription?.status === 'active'

  const handleSubscribe = async (plan: PlanConfig) => {
    if (plan.id === 'free') return

    setLoadingPlan(plan.id)
    try {
      const priceId = billingCycle === 'monthly' ? plan.monthlyPriceId : plan.yearlyPriceId
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Subscribe error:', error)
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Portal error:', error)
    } finally {
      setPortalLoading(false)
    }
  }

  const planIcons: Record<string, React.ReactNode> = {
    free: <Sparkles className="size-6" />,
    pro: <Zap className="size-6" />,
    max: <Crown className="size-6" />,
  }

  const savingsPercent = Math.round(
    ((9.99 * 12 - 79.99) / (9.99 * 12)) * 100
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Plans that grow with you
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose the plan that fits your expense splitting needs.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-muted/50 p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
              billingCycle === 'monthly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
              billingCycle === 'annual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Annual
            <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Save {savingsPercent}%
            </span>
          </button>
        </div>
      </div>

      {/* Current Plan Notice */}
      {currentPlan !== 'free' && isActive && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-700 dark:text-emerald-300">
            <Check className="size-4" />
            <span>
              You are on the <strong className="capitalize">{currentPlan}</strong> plan
              {subscription?.cancelAtPeriodEnd && (
                <span className="text-muted-foreground"> · Cancels at period end</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id && isActive
          const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice
          const monthlyEquivalent = billingCycle === 'annual' && plan.yearlyPrice > 0
            ? (plan.yearlyPrice / 12).toFixed(2)
            : null

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-xl border p-6 transition-all',
                plan.highlighted
                  ? 'border-primary/50 bg-card shadow-lg shadow-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-border/80',
                isCurrent && 'ring-2 ring-emerald-500/30 border-emerald-500/40'
              )}
            >
              {/* Highlighted badge */}
              {plan.highlighted && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Icon & Name */}
              <div className="mb-4">
                <div className={cn(
                  'mb-3 inline-flex rounded-lg p-2',
                  plan.id === 'free' && 'bg-muted text-muted-foreground',
                  plan.id === 'pro' && 'bg-primary/10 text-primary',
                  plan.id === 'max' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                )}>
                  {planIcons[plan.id]}
                </div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-5">
                {price === 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight">$0</span>
                    <span className="text-sm text-muted-foreground">/forever</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight">
                        ${billingCycle === 'monthly' ? price.toFixed(2) : monthlyEquivalent}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /month
                      </span>
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        ${price.toFixed(2)} billed annually
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <div className="mb-6">
                {isCurrent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Loading...</>
                    ) : (
                      <><ExternalLink className="size-3.5 mr-1.5" /> Manage subscription</>
                    )}
                  </Button>
                ) : plan.id === 'free' ? (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    {currentPlan === 'free' ? 'Current plan' : 'Downgrade'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className={cn(
                      'w-full',
                      plan.highlighted
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : ''
                    )}
                    onClick={() => handleSubscribe(plan)}
                    disabled={loadingPlan === plan.id}
                  >
                    {loadingPlan === plan.id ? (
                      <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Processing...</>
                    ) : (
                      `Get ${plan.name} plan`
                    )}
                  </Button>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2.5 border-t border-border pt-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {plan.id === 'free' ? 'Includes:' : plan.id === 'pro' ? 'Everything in Free, and:' : 'Everything in Pro, plus:'}
                </p>
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className={cn(
                      'size-4 mt-0.5 shrink-0',
                      plan.id === 'free' && 'text-muted-foreground',
                      plan.id === 'pro' && 'text-primary',
                      plan.id === 'max' && 'text-amber-500',
                    )} />
                    <span className="text-sm text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Prices shown don&apos;t include applicable tax. Cancel anytime.
      </p>
    </div>
  )
}
