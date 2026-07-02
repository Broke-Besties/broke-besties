"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { splitEvenly } from "@/lib/split";
import { createGroupExpense } from "./actions";

type Member = {
  id: number;
  user: { id: string; name: string; email: string };
};

type Row = { selected: boolean; amount: string };

export function SplitExpenseModal({
  groupId,
  members,
  currentUserId,
}: {
  groupId: number;
  members: Member[];
  currentUserId: string;
}) {
  // Participants are everyone except the payer (current user).
  const participants = members.filter((m) => m.user.id !== currentUserId);

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalNum = parseFloat(total) || 0;
  const selectedIds = participants
    .map((p) => p.user.id)
    .filter((id) => rows[id]?.selected);
  const sharesSum = selectedIds.reduce(
    (sum, id) => sum + (parseFloat(rows[id]?.amount) || 0),
    0
  );
  const overTotal = sharesSum - totalNum > 0.01;

  function toggle(id: string) {
    setRows((prev) => ({
      ...prev,
      [id]: { selected: !prev[id]?.selected, amount: prev[id]?.amount ?? "" },
    }));
  }

  function setAmount(id: string, amount: string) {
    setRows((prev) => ({
      ...prev,
      [id]: { selected: prev[id]?.selected ?? true, amount },
    }));
  }

  function splitEven() {
    if (!totalNum || selectedIds.length === 0) return;
    const shares = splitEvenly(totalNum, selectedIds.length);
    setRows((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id, i) => {
        next[id] = { selected: true, amount: shares[i].toFixed(2) };
      });
      return next;
    });
  }

  function reset() {
    setDescription("");
    setTotal("");
    setRows({});
    setError("");
  }

  async function handleSubmit() {
    setError("");
    if (!totalNum || totalNum <= 0) {
      setError("Enter a valid total amount");
      return;
    }
    const shares = selectedIds
      .map((id) => ({ userId: id, amount: parseFloat(rows[id]?.amount) || 0 }))
      .filter((s) => s.amount > 0);
    if (shares.length === 0) {
      setError("Select at least one person and enter their share");
      return;
    }
    if (overTotal) {
      setError("Shares add up to more than the total");
      return;
    }

    setSubmitting(true);
    const res = await createGroupExpense({
      groupId,
      totalAmount: totalNum,
      description: description || undefined,
      shares,
    });
    setSubmitting(false);

    if (res.success) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(res.error || "Failed to create expense");
    }
  }

  const router = useRouter();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={participants.length === 0}>
          Split expense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split an expense</DialogTitle>
          <DialogDescription>
            You paid the bill — pick who shares it and how much each owes you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-desc">Description</Label>
            <Input
              id="expense-desc"
              placeholder="e.g. Dinner at Luigi's"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-total">Total amount ($)</Label>
            <Input
              id="expense-total"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Who shares it?</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={splitEven}
                disabled={!totalNum || selectedIds.length === 0}
              >
                Split evenly
              </Button>
            </div>

            {participants.map((p) => {
              const row = rows[p.user.id];
              return (
                <div key={p.user.id} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={row?.selected ? "default" : "outline"}
                    size="sm"
                    className={cn("min-w-24 justify-start", "flex-1")}
                    onClick={() => toggle(p.user.id)}
                  >
                    {p.user.name}
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-28"
                    disabled={!row?.selected}
                    value={row?.amount ?? ""}
                    onChange={(e) => setAmount(p.user.id, e.target.value)}
                  />
                </div>
              );
            })}
          </div>

          <p
            className={cn(
              "text-sm",
              overTotal ? "text-destructive" : "text-muted-foreground"
            )}
          >
            Assigned ${sharesSum.toFixed(2)} of ${totalNum.toFixed(2)}
            {totalNum - sharesSum > 0.01 && !overTotal
              ? ` — you keep $${(totalNum - sharesSum).toFixed(2)}`
              : ""}
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create debts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
