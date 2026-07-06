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
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createTab } from "./actions";
import type { Tab, TabDirection } from "./types";

export function CreateTabDialog({
  open,
  onOpenChange,
  defaultDirection = "borrowing",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDirection?: TabDirection;
  onCreated: (tab: Tab) => void;
}) {
  const [direction, setDirection] = useState<TabDirection>(defaultDirection);
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setDirection(defaultDirection);
    setPersonName("");
    setAmount("");
    setDescription("");
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
    return Math.round(parsed * 100) / 100;
  };

  const handleAmountBlur = () => {
    const parsed = parseAmount();
    if (parsed == null) {
      setAmountError(amount ? "Enter an amount greater than zero." : null);
      return;
    }
    setAmountError(null);
    setAmount(parsed.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmount();
    if (parsedAmount == null) {
      setAmountError("Enter an amount greater than zero.");
      return;
    }

    setCreating(true);
    try {
      const result = await createTab({
        amount: parsedAmount,
        description,
        personName,
        status: direction,
      });

      if (!result.success || !result.tab) {
        toast.error(result.error || "Failed to create tab");
        return;
      }

      toast.success("Tab added");
      onCreated(result.tab as Tab);
      handleOpenChange(false);
    } catch {
      toast.error("An error occurred while creating the tab");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new tab</DialogTitle>
          <DialogDescription>
            Track money you lent or borrowed outside the platform.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={direction}
                onValueChange={(value) => {
                  if (value) setDirection(value as TabDirection);
                }}
              >
                <ToggleGroupItem value="borrowing">I borrowed</ToggleGroupItem>
                <ToggleGroupItem value="lending">I lent</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="tab-person">
                {direction === "borrowing"
                  ? "Who do you owe?"
                  : "Who owes you?"}
              </FieldLabel>
              <Input
                id="tab-person"
                type="text"
                required
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g. John, Mom, Coffee Shop"
              />
            </Field>
            <Field data-invalid={amountError ? true : undefined}>
              <FieldLabel htmlFor="tab-amount">Amount</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="tab-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
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
            <Field>
              <FieldLabel htmlFor="tab-description">What for?</FieldLabel>
              <Textarea
                id="tab-description"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Lunch last Tuesday"
              />
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
            <Button type="submit" disabled={creating}>
              {creating && <Spinner />}
              Add tab
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
