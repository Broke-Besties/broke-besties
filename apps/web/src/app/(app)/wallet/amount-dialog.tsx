"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import type { WalletTransaction } from "./types";
import { createDeposit, withdraw } from "./actions";

export type AmountDialogMode = "deposit" | "withdraw";

export function AmountDialog({
  mode,
  open,
  onOpenChange,
  balanceCents,
  onCompleted,
}: {
  mode: AmountDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceCents: number;
  onCompleted: (
    walletTransaction: WalletTransaction,
    amountCents: number
  ) => void;
}) {
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDeposit = mode === "deposit";
  const verb = isDeposit ? "deposit" : "withdraw";

  const resetForm = () => {
    setAmount("");
    setAmountError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  // Amount is kept as the raw typed string and only parsed/rounded on blur
  // and submit, so typing "12." never snaps back to "12" mid-entry.
  const parseAmount = (): number | null => {
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const cents = Math.round(parsed * 100);
    if (cents < 50) return null;
    return cents;
  };

  const handleAmountBlur = () => {
    const cents = parseAmount();
    if (cents == null) {
      setAmountError(
        amount ? "Enter an amount of at least $0.50." : null
      );
      return;
    }
    setAmountError(null);
    setAmount((cents / 100).toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseAmount();
    if (cents == null) {
      setAmountError("Enter an amount of at least $0.50.");
      return;
    }
    if (!isDeposit && cents > balanceCents) {
      setAmountError("Amount exceeds your wallet balance.");
      return;
    }

    setSubmitting(true);
    try {
      if (isDeposit) {
        const result = await createDeposit(cents);
        if (!result.success || !result.url) {
          toast.error(result.error || "Failed to start the deposit");
          return;
        }
        handleOpenChange(false);
        window.location.href = result.url;
      } else {
        const result = await withdraw(cents);
        if (!result.success) {
          toast.error(result.error || "Failed to withdraw");
          return;
        }
        toast.success(`Withdrew $${(cents / 100).toFixed(2)}`);
        handleOpenChange(false);
        onCompleted(result.walletTransaction as WalletTransaction, cents);
      }
    } catch {
      toast.error(`An error occurred while processing the ${verb}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDeposit ? "Deposit money" : "Withdraw money"}
          </DialogTitle>
          <DialogDescription>
            {isDeposit
              ? "Add funds to your wallet via Stripe Checkout."
              : `Move funds from your wallet to your connected Stripe account. Balance: $${(
                  balanceCents / 100
                ).toFixed(2)}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={amountError ? true : undefined}>
              <FieldLabel htmlFor="wallet-amount">Amount</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="wallet-amount"
                  type="number"
                  step="0.01"
                  min="0.50"
                  inputMode="decimal"
                  required
                  value={amount}
                  aria-invalid={amountError ? true : undefined}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (amountError) setAmountError(null);
                  }}
                  onBlur={handleAmountBlur}
                  placeholder="0.00"
                />
              </InputGroup>
              {amountError && <FieldError>{amountError}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner />}
              {isDeposit ? "Deposit" : "Withdraw"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
