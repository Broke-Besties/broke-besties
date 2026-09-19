"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleCheck,
  CircleX,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountDialog, type AmountDialogMode } from "./amount-dialog";
import { formatCents, type Wallet, type WalletTransaction } from "./types";

const statusBadge = {
  pending: {
    variant: "outline" as const,
    label: "Pending",
    icon: Clock,
  },
  completed: {
    variant: "default" as const,
    label: "Completed",
    icon: CircleCheck,
  },
  failed: {
    variant: "destructive" as const,
    label: "Failed",
    icon: CircleX,
  },
};

function TransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const isDeposit = transaction.type === "deposit";
  const status =
    statusBadge[transaction.status as keyof typeof statusBadge] ??
    statusBadge.pending;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          {isDeposit ? (
            <ArrowDownToLine className="size-4" aria-hidden />
          ) : (
            <ArrowUpFromLine className="size-4" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {isDeposit ? "Deposit" : "Withdrawal"}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`text-sm font-semibold tabular-nums ${
            isDeposit ? "text-emerald-600 dark:text-emerald-400" : ""
          }`}
        >
          {isDeposit ? "+" : "-"}
          {formatCents(transaction.amountCents)}
        </span>
        <Badge variant={status.variant} className="gap-1">
          <StatusIcon className="size-3" aria-hidden />
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

export default function WalletPageClient({
  wallet,
  transactions,
  depositStatus,
}: {
  wallet: Wallet;
  transactions: WalletTransaction[];
  depositStatus: string | null;
}) {
  const [balanceCents, setBalanceCents] = useState(wallet.balanceCents);
  const [txs, setTxs] = useState(transactions);
  const [dialogMode, setDialogMode] = useState<AmountDialogMode | null>(null);

  const router = useRouter();

  // Surface the result of the Stripe Checkout redirect
  useEffect(() => {
    if (depositStatus === "success") {
      toast.success("Deposit completed");
    } else if (depositStatus === "cancelled") {
      toast.info("Deposit cancelled");
    }
    if (depositStatus) {
      // Clear the query params once the server has synced the deposit
      router.replace("/wallet", { scroll: false });
    }
  }, [depositStatus, router]);

  return (
    <>
      <PageHeader
        title="Wallet"
        description="Your balance for deposits and payouts via Stripe."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setDialogMode("deposit")}>
              <ArrowDownToLine aria-hidden />
              Deposit
            </Button>
            <Button
              variant="outline"
              onClick={() => setDialogMode("withdraw")}
              disabled={balanceCents <= 0}
            >
              <ArrowUpFromLine aria-hidden />
              Withdraw
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:max-w-sm">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tabular-nums">
              {formatCents(balanceCents)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet. Make a deposit to get started.
            </p>
          ) : (
            <div className="divide-y">
              {txs.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AmountDialog
        mode={dialogMode ?? "deposit"}
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
        balanceCents={balanceCents}
        onCompleted={(walletTransaction, amountCents) => {
          // Optimistically reflect the withdrawal
          setBalanceCents((cents) => cents - amountCents);
          setTxs((prevTxs) => [walletTransaction, ...prevTxs]);
        }}
      />
    </>
  );
}
