"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DialogOverlay,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Split, User } from "lucide-react"
import type { FriendDashboardData } from "./types"

interface AddDebtDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: FriendDashboardData
  onSubmit: (payload: {
    amount: number
    description: string
    borrowerId: string
    isSplit: boolean
  }) => void
  loading?: boolean
}

export function AddDebtDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
  loading,
}: AddDebtDialogProps) {
  const { friend, currentUserId } = data

  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [borrowerId, setBorrowerId] = useState(friend.id)
  const [isSplit, setIsSplit] = useState(false)

  const displayAmount =
    isSplit && amount ? (parseFloat(amount) / 2).toFixed(2) : amount

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || !description.trim()) return
    onSubmit({
      amount: isSplit ? parsed / 2 : parsed,
      description: description.trim(),
      borrowerId,
      isSplit,
    })
    // Reset
    setAmount("")
    setDescription("")
    setBorrowerId(friend.id)
    setIsSplit(false)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <DialogOverlay onClick={() => onOpenChange(false)} />
      <DialogContent className="bg-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold text-foreground">
            Add New Debt
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            Log a debt with{" "}
            <span className="text-foreground font-medium">{friend.name}</span>.
            Both parties will be notified.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          {/* Borrower */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
              Who Owes
            </Label>
            <Select value={borrowerId} onValueChange={setBorrowerId}>
              <SelectTrigger className="h-9 text-[13px] bg-secondary border-border/40">
                <div className="flex items-center gap-2">
                  <User size={12} className="text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                <SelectItem
                  value={friend.id}
                  className="text-[13px] cursor-pointer"
                >
                  {friend.name} (them)
                </SelectItem>
                <SelectItem
                  value={currentUserId}
                  className="text-[13px] cursor-pointer"
                >
                  Me (you owe them)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground font-mono">
                $
              </span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-6 h-9 text-[13px] bg-secondary border-border/40 font-mono"
                required
              />
            </div>
            {isSplit && amount && (
              <p className="text-[11px] text-muted-foreground/70 font-mono">
                Each person pays{" "}
                <span className="text-foreground">${displayAmount}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </Label>
            <Input
              type="text"
              placeholder="e.g. Dinner at Nobu, Uber home..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 text-[13px] bg-secondary border-border/40"
              required
            />
          </div>

          {/* Split 50/50 toggle */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-md bg-secondary/50 border border-border/30">
            <div className="flex items-center gap-2">
              <Split size={13} className="text-muted-foreground" />
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  Split 50/50
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Divide the amount equally between you both
                </p>
              </div>
            </div>
            <Switch
              checked={isSplit}
              onCheckedChange={setIsSplit}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          <DialogFooter className="pt-1 gap-2 flex-row">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[13px] h-8 text-muted-foreground"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-[13px] h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold flex-1"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Debt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </div>
  )
}
