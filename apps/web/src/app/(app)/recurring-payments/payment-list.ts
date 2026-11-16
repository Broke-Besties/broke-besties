export type RecurringPayment = {
  id: number
  amount: number
  description: string | null
  status: string
  frequency: number
  createdAt: Date | string
  lender: { id: string; email: string; name: string }
  borrowers: {
    id: number
    userId: string
    splitPercentage: number
    user: { id: string; email: string; name: string }
  }[]
  group?: { id: number; name: string } | null
}

export type PaymentFilters = {
  view: 'all' | 'lending' | 'borrowing'
  status: 'all' | 'active' | 'inactive'
  person: string
  group: string
  search: string
}

export function filterRecurringPayments(
  payments: RecurringPayment[],
  currentUserId: string,
  filters: PaymentFilters,
) {
  const query = filters.search.trim().toLocaleLowerCase()
  return payments
    .filter((payment) => {
      if (filters.view === 'lending' && payment.lender.id !== currentUserId)
        return false
      if (
        filters.view === 'borrowing' &&
        !payment.borrowers.some((b) => b.userId === currentUserId)
      )
        return false
      if (filters.status !== 'all' && payment.status !== filters.status)
        return false
      if (filters.group === 'none' && payment.group) return false
      if (
        filters.group !== 'all' &&
        filters.group !== 'none' &&
        String(payment.group?.id) !== filters.group
      )
        return false
      const people = [payment.lender, ...payment.borrowers.map((b) => b.user)]
      if (
        filters.person !== 'all' &&
        !people.some((person) => person.id === filters.person)
      )
        return false
      return (
        !query ||
        [
          payment.description,
          payment.group?.name,
          ...people.flatMap((person) => [person.name, person.email]),
        ].some((value) => value?.toLocaleLowerCase().includes(query))
      )
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        b.id - a.id,
    )
}
