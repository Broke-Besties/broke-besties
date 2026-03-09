import { getUser } from "@/lib/supabase"
import { prisma } from "@/lib/prisma"
import { friendService } from "@/services/friend.service"
import { debtTransactionService } from "@/services/debt-transaction.service"
import { redirect, notFound } from "next/navigation"
import { FriendDashboard } from "./friend-dashboard"
import type {
  FriendDashboardData,
  SerializedDebt,
  SerializedDebtTransaction,
  CommonGroup,
  SharedRecurring,
} from "./types"

function serializeDebt(debt: {
  id: number
  amount: number
  description: string | null
  status: string
  lenderId: string
  borrowerId: string
  groupId: number | null
  alertId: number | null
  createdAt: Date
  updatedAt: Date
}): SerializedDebt {
  return {
    id: debt.id,
    amount: debt.amount,
    description: debt.description,
    status: debt.status,
    lenderId: debt.lenderId,
    borrowerId: debt.borrowerId,
    groupId: debt.groupId,
    alertId: debt.alertId,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
  }
}

export default async function FriendDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getUser()
  if (!user) redirect("/login")

  const { id: friendUserId } = await params

  // Verify friendship exists (security check)
  const friendship = await friendService.getFriendship(user.id, friendUserId)
  if (!friendship || friendship.status !== "accepted") {
    notFound()
  }

  // Parallel data fetch
  const [
    friendRecord,
    activeDebts,
    settledDebts,
    allPendingTransactions,
    commonGroupMembers,
    sharedRecurringPayments,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: friendUserId },
      select: { id: true, name: true, email: true },
    }),
    prisma.debt.findMany({
      where: {
        status: { not: "paid" },
        OR: [
          { lenderId: user.id, borrowerId: friendUserId },
          { lenderId: friendUserId, borrowerId: user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.debt.findMany({
      where: {
        status: "paid",
        OR: [
          { lenderId: user.id, borrowerId: friendUserId },
          { lenderId: friendUserId, borrowerId: user.id },
        ],
      },
      orderBy: { updatedAt: "desc" },
    }),
    debtTransactionService.getUserPendingTransactions(user.id),
    // Common groups: find groups where both users are members
    prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            members: true,
          },
        },
      },
    }),
    // Shared recurring: find recurring payments involving both users
    prisma.recurringPayment.findMany({
      where: {
        status: "active",
        OR: [
          {
            lenderId: user.id,
            borrowers: { some: { userId: friendUserId } },
          },
          {
            lenderId: friendUserId,
            borrowers: { some: { userId: user.id } },
          },
        ],
      },
      include: {
        borrowers: {
          where: {
            userId: { in: [user.id, friendUserId] },
          },
        },
      },
    }),
  ])

  if (!friendRecord) notFound()

  // Filter pending transactions to only those involving this friend
  const pendingTransactions = allPendingTransactions.filter(
    (tx) =>
      tx.debt.lenderId === friendUserId ||
      tx.debt.borrowerId === friendUserId
  )

  // Compute net balance: positive = friend owes you
  const lentTotal = activeDebts
    .filter((d) => d.lenderId === user.id)
    .reduce((sum, d) => sum + d.amount, 0)
  const owedTotal = activeDebts
    .filter((d) => d.borrowerId === user.id)
    .reduce((sum, d) => sum + d.amount, 0)
  const netBalance = lentTotal - owedTotal

  // Common groups: filter to groups where friend is also a member
  const commonGroups: CommonGroup[] = commonGroupMembers
    .filter((gm) => gm.group.members.some((m) => m.userId === friendUserId))
    .map((gm) => ({
      id: gm.group.id,
      name: gm.group.name,
      memberCount: gm.group.members.length,
    }))

  // Shared recurring payments
  const sharedRecurring: SharedRecurring[] = sharedRecurringPayments.map(
    (rp) => {
      const borrower = rp.borrowers[0]
      return {
        id: rp.id,
        amount: rp.amount,
        description: rp.description,
        status: rp.status,
        lenderId: rp.lenderId,
        frequency: rp.frequency,
        splitPercentage: borrower?.splitPercentage ?? 50,
      }
    }
  )

  // Friends since date
  const friendsSince = friendship.createdAt.toISOString()

  // Serialize pending transactions
  const serializedPendingTransactions: SerializedDebtTransaction[] =
    pendingTransactions.map((tx) => ({
      id: tx.id,
      debtId: tx.debtId,
      type: tx.type,
      status: tx.status,
      requesterId: tx.requesterId,
      lenderApproved: tx.lenderApproved,
      borrowerApproved: tx.borrowerApproved,
      proposedAmount: tx.proposedAmount,
      proposedDescription: tx.proposedDescription,
      reason: tx.reason,
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
      resolvedAt: tx.resolvedAt?.toISOString() ?? null,
      debt: serializeDebt(tx.debt),
    }))

  const data: FriendDashboardData = {
    currentUserId: user.id,
    friend: {
      id: friendRecord.id,
      name: friendRecord.name,
      email: friendRecord.email,
    },
    friendsSince,
    netBalance,
    activeDebts: activeDebts.map(serializeDebt),
    pendingTransactions: serializedPendingTransactions,
    settledDebts: settledDebts.map(serializeDebt),
    commonGroups,
    sharedRecurring,
  }

  return <FriendDashboard data={data} />
}
