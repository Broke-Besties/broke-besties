// Types for the Friend Dashboard — derived from Prisma models

import type {
  Debt as PrismaDebt,
  DebtTransaction as PrismaDebtTransaction,
  RecurringPayment as PrismaRecurringPayment,
} from "@prisma/client"

export type SerializedDebt = Omit<PrismaDebt, "createdAt" | "updatedAt"> & {
  createdAt: string
  updatedAt: string
}

export type SerializedDebtTransaction = Omit<
  PrismaDebtTransaction,
  "createdAt" | "updatedAt" | "resolvedAt"
> & {
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  debt: SerializedDebt
}

export interface FriendUser {
  id: string
  name: string
  email: string
}

export interface CommonGroup {
  id: number
  name: string
  memberCount: number
}

export interface SharedRecurring {
  id: number
  amount: number
  description: string | null
  status: string
  lenderId: string
  frequency: number
  splitPercentage: number
}

export interface FriendDashboardData {
  currentUserId: string
  friend: FriendUser
  friendsSince: string // ISO date string
  netBalance: number
  activeDebts: SerializedDebt[]
  pendingTransactions: SerializedDebtTransaction[]
  settledDebts: SerializedDebt[]
  commonGroups: CommonGroup[]
  sharedRecurring: SharedRecurring[]
}
