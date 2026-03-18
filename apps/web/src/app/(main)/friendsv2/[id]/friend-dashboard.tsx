"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FriendHeader } from "./friend-header"
import { DebtLedger } from "./debt-ledger"
import { SidebarCards } from "./sidebar-cards"
import { AddDebtDialog } from "./add-debt-dialog"
import { createStandaloneDebt, respondToTransaction } from "../../debts/actions"
import type { FriendDashboardData } from "./types"

interface FriendDashboardProps {
  data: FriendDashboardData
}

export function FriendDashboard({ data }: FriendDashboardProps) {
  const router = useRouter()
  const [addDebtOpen, setAddDebtOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAddDebt(payload: {
    amount: number
    description: string
    borrowerId: string
    isSplit: boolean
  }) {
    setLoading(true)
    try {
      const result = await createStandaloneDebt({
        amount: payload.amount,
        description: payload.description,
        borrowerId: payload.borrowerId,
      })
      if (result.success) {
        toast.success("Debt added")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to add debt")
      }
    } catch {
      toast.error("Failed to add debt")
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmTransaction(txId: number) {
    try {
      const result = await respondToTransaction(txId, true)
      if (result.success) {
        toast.success("Transaction confirmed")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to confirm")
      }
    } catch {
      toast.error("Failed to confirm transaction")
    }
  }

  async function handleRejectTransaction(txId: number) {
    try {
      const result = await respondToTransaction(txId, false)
      if (result.success) {
        toast.success("Transaction rejected")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to reject")
      }
    } catch {
      toast.error("Failed to reject transaction")
    }
  }

  function handleSettleUp() {
    toast.info("Coming soon")
  }

  function handleNudge() {
    toast.success(`Nudge sent to ${data.friend.name}`)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
        <FriendHeader
          data={data}
          onSettleUp={handleSettleUp}
          onRequest={() => setAddDebtOpen(true)}
          onNudge={handleNudge}
          onAddDebt={() => setAddDebtOpen(true)}
        />

        <div className="border-t border-border" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          <DebtLedger
            data={data}
            onConfirmTransaction={handleConfirmTransaction}
            onRejectTransaction={handleRejectTransaction}
          />
          <SidebarCards data={data} />
        </div>
      </div>

      <AddDebtDialog
        open={addDebtOpen}
        onOpenChange={setAddDebtOpen}
        data={data}
        onSubmit={handleAddDebt}
        loading={loading}
      />
    </main>
  )
}
