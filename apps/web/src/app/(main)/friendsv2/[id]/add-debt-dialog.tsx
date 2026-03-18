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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add debt</DialogTitle>
          <DialogDescription>
            Log a debt with {friend.name}. Both parties will be notified.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Who owes</Label>
            <Select value={borrowerId} onValueChange={setBorrowerId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={friend.id} className="text-sm cursor-pointer">
                  {friend.name} owes me
                </SelectItem>
                <SelectItem value={currentUserId} className="text-sm cursor-pointer">
                  I owe {friend.name}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-6 h-9 text-sm tabular-nums"
                required
              />
            </div>
            {isSplit && amount && (
              <p className="text-xs text-muted-foreground">
                Each person pays ${displayAmount}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Description</Label>
            <Input
              type="text"
              placeholder="e.g. Dinner, Uber, Groceries..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 text-sm"
              required
            />
          </div>

          <div className="flex items-center justify-between py-2.5 px-3 rounded-md bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">
                Split 50/50
              </p>
              <p className="text-xs text-muted-foreground">
                Divide equally between both of you
              </p>
            </div>
            <Switch
              checked={isSplit}
              onCheckedChange={setIsSplit}
            />
          </div>

          <DialogFooter className="pt-1 gap-2 flex-row">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-sm flex-1"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add debt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </div>
  )
}
