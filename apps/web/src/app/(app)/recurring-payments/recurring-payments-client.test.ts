import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, describe, expect, it, vi } from 'vitest'
import RecurringPaymentsClient from './recurring-payments-client'
import type { RecurringPayment } from './payment-list'
import type { User } from '@supabase/supabase-js'

vi.mock('./actions', () => ({ toggleRecurringPaymentStatus: vi.fn() }))
vi.mock('./recurring-form-item', () => ({ default: () => null }))
vi.stubGlobal('React', React)
afterAll(() => vi.unstubAllGlobals())
const me = { id: 'me', name: 'Daniel', email: 'me@example.com' }
const friend = { id: 'friend', name: 'Alex', email: 'alex@example.com' }
const payment = (id: number): RecurringPayment => ({
  id,
  amount: 40,
  frequency: 30,
  status: 'active',
  description: `Internet ${id}`,
  createdAt: '2026-11-15T00:00:00Z',
  lender: friend,
  borrowers: [{ id, userId: 'me', user: me, splitPercentage: 25 }],
  group: { id: 1, name: 'Roommates' },
})
function render(payments: RecurringPayment[]) {
  return renderToStaticMarkup(
    React.createElement(RecurringPaymentsClient, {
      initialRecurringPayments: payments,
      currentUser: {
        ...me,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-11-15T00:00:00Z',
      } satisfies User,
    }),
  )
}

describe('recurring payments table', () => {
  it('shows ten rows with people, groups, individual shares, and working page controls', () => {
    const html = render(
      Array.from({ length: 24 }, (_, index) => payment(index + 1)),
    )
    expect(html.match(/data-slot="table-row"/g)).toHaveLength(11)
    expect(html).toContain('1–10 of 24 payments')
    expect(html).toContain('Page 1 of 3')
    expect(html).toContain('Go to next page')
    expect(html).toContain('href="/groups/1"')
    expect(html).toContain('From Alex')
    expect(html).toContain('To you')
    expect(html).toContain('Your share $10.00')
    expect(html).toContain('Rows per page')
    expect(html).toContain('recurring-person')
    expect(html).toContain('recurring-group')
    expect(html).not.toContain('Deactivate')
  })
  it('provides lender actions and a clear no-group label', () => {
    const html = render([{ ...payment(1), lender: me, group: null }])
    expect(html).toContain('Deactivate Internet 1')
    expect(html).toContain('No group')
    expect(html).toContain('From you')
  })
  it('offers creation without pagination when there are no payments', () => {
    const html = render([])
    expect(html).toContain('No recurring payments yet')
    expect(html).not.toContain('Recurring payment pages')
    expect(html).not.toContain('data-slot="table"')
  })
})
