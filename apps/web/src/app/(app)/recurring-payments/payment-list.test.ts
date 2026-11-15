import { describe, expect, it } from 'vitest'
import {
  filterRecurringPayments,
  type PaymentFilters,
  type RecurringPayment,
} from './payment-list'
import { pageBounds } from '../debts/pagination'

const me = { id: 'me', name: 'Daniel', email: 'me@example.com' }
const alex = { id: 'alex', name: 'Alex Chen', email: 'alex@example.com' }
const maya = { id: 'maya', name: 'Maya Chen', email: 'maya@example.com' }
const filters: PaymentFilters = {
  view: 'all',
  status: 'all',
  person: 'all',
  group: 'all',
  search: '',
}
const payment = (
  id: number,
  patch: Partial<RecurringPayment> = {},
): RecurringPayment => ({
  id,
  amount: 30,
  description: 'Internet',
  frequency: 30,
  status: 'active',
  createdAt: new Date(2026, 10, id),
  lender: me,
  borrowers: [{ id, userId: alex.id, user: alex, splitPercentage: 100 }],
  group: { id: 1, name: 'Roommates' },
  ...patch,
})
const payments = [
  payment(1),
  payment(2, {
    lender: maya,
    group: null,
    status: 'inactive',
    borrowers: [{ id: 2, userId: me.id, user: me, splitPercentage: 25 }],
  }),
  payment(3, { group: { id: 2, name: 'Weekend' } }),
]

describe('recurring payment list', () => {
  it('combines person, group, status, direction, and search before sorting', () => {
    expect(
      filterRecurringPayments(payments, me.id, {
        ...filters,
        view: 'lending',
        person: alex.id,
        group: '1',
        status: 'active',
        search: ' INTERNET ',
      }).map((p) => p.id),
    ).toEqual([1])
    expect(
      filterRecurringPayments(payments, me.id, {
        ...filters,
        person: alex.id,
        group: 'none',
      }),
    ).toEqual([])
    expect(
      filterRecurringPayments(payments, me.id, {
        ...filters,
        view: 'borrowing',
        person: maya.id,
        status: 'inactive',
      }).map((p) => p.id),
    ).toEqual([2])
  })
  it('searches lenders, borrowers, emails, and real group names case insensitively', () => {
    for (const search of ['Alex Chen', 'ALEX@EXAMPLE.COM', 'weekend']) {
      const found = filterRecurringPayments(payments, me.id, {
        ...filters,
        search,
      })
      expect(found.map((p) => p.id)).toEqual(
        search === 'weekend' ? [3] : [3, 1],
      )
    }
    expect(
      filterRecurringPayments(payments, me.id, {
        ...filters,
        search: 'maya',
      }).map((p) => p.id),
    ).toEqual([2])
  })
  it('distinguishes no group from a named group and tolerates newly created records without loaded group data', () => {
    expect(
      filterRecurringPayments(payments, me.id, {
        ...filters,
        group: 'none',
      }).map((p) => p.id),
    ).toEqual([2])
    expect(
      filterRecurringPayments(
        [payment(4, { group: undefined, description: null })],
        me.id,
        { ...filters, group: 'none' },
      ),
    ).toHaveLength(1)
    expect(
      filterRecurringPayments(payments, me.id, { ...filters, group: '2' }).map(
        (p) => p.id,
      ),
    ).toEqual([3])
  })
  it('sorts a copy and paginates filtered results without empty or overlapping pages', () => {
    const source = Array.from({ length: 24 }, (_, index) => payment(index + 1))
    const sorted = filterRecurringPayments(source, me.id, filters)
    const first = pageBounds(sorted.length, 1, 10)
    const last = pageBounds(sorted.length, 3, 10)
    expect(sorted.slice(first.start, first.end).map((p) => p.id)).toEqual([
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15,
    ])
    expect(sorted.slice(last.start, last.end).map((p) => p.id)).toEqual([
      4, 3, 2, 1,
    ])
    expect(source[0].id).toBe(1)
    expect(pageBounds(2, 3, 10)).toMatchObject({
      page: 1,
      pageCount: 1,
      start: 0,
      end: 2,
    })
    expect(pageBounds(0, 3, 10)).toMatchObject({
      page: 1,
      pageCount: 1,
      start: 0,
      end: 0,
    })
  })
})
