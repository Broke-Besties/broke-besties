const NAMED_CADENCES: Record<number, string> = {
  1: 'daily',
  7: 'weekly',
  14: 'biweekly',
  30: 'monthly',
}

/** Named cadence ("monthly", "weekly", "biweekly", "daily") when one exists, otherwise null. */
export function namedCadence(frequencyDays: number): string | null {
  return NAMED_CADENCES[frequencyDays] ?? null
}

/** "$X.XX every N days" — the canonical short identity of a recurring payment. */
export function frequencyText(frequencyDays: number): string {
  return `every ${frequencyDays} day${frequencyDays === 1 ? '' : 's'}`
}

export function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
