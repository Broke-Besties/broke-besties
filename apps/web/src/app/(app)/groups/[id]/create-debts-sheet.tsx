"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { DebtFormItem, type DebtFormErrors } from "./debt-form-item";
import { createDebt, createDebts } from "./actions";
import type { Member } from "./types";

type DebtFormData = {
  amount: string;
  description: string;
  borrowerId: string;
  borrower: { id: string; name: string; email: string } | null;
  alertMessage: string;
  alertDeadline: string;
};

type CreateDebtsSheetProps = {
  groupId: number;
  members: Member[];
  currentUserId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function emptyDebtForm(): DebtFormData {
  return {
    amount: "",
    description: "",
    borrowerId: "",
    borrower: null,
    alertMessage: "",
    alertDeadline: "",
  };
}

function validateDebtForm(form: DebtFormData): DebtFormErrors {
  const errors: DebtFormErrors = {};
  if (!form.borrowerId) {
    errors.borrower = "Select a borrower";
  }
  if (!form.amount || parseFloat(form.amount) <= 0) {
    errors.amount = "Enter an amount greater than 0";
  }
  return errors;
}

export function CreateDebtsSheet({
  groupId,
  members,
  currentUserId,
  open,
  onOpenChange,
}: CreateDebtsSheetProps) {
  const [debtForms, setDebtForms] = useState<DebtFormData[]>([emptyDebtForm()]);
  const [showValidation, setShowValidation] = useState(false);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const router = useRouter();

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      })),
    [members]
  );

  const resetForm = () => {
    setDebtForms([emptyDebtForm()]);
    setShowValidation(false);
    setFormError("");
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleReceiptFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setFormError("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError("File too large. Maximum size is 10MB.");
      return;
    }

    setReceiptFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setFormError("");
  };

  const addDebtForm = () => {
    setDebtForms((forms) => [...forms, emptyDebtForm()]);
  };

  const removeDebtForm = (index: number) => {
    setDebtForms((forms) =>
      forms.length === 1 ? forms : forms.filter((_, i) => i !== index)
    );
  };

  const updateDebtForm = (index: number, data: DebtFormData) => {
    setDebtForms((forms) =>
      forms.map((form, i) => (i === index ? data : form))
    );
  };

  const handleCreateDebts = async () => {
    setShowValidation(true);
    setFormError("");

    const hasInvalid = debtForms.some(
      (form) => Object.keys(validateDebtForm(form)).length > 0
    );
    if (hasInvalid) {
      setFormError("Fix the highlighted fields below, then try again.");
      return;
    }

    setCreating(true);

    try {
      // Upload the receipt once; it applies to every debt in the batch.
      let receiptId: string | undefined;
      if (receiptFile) {
        const formData = new FormData();
        formData.append("file", receiptFile);
        formData.append("groupId", groupId.toString());

        const uploadResponse = await fetch("/api/receipts/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Failed to upload receipt");
        }

        const uploadData = await uploadResponse.json();
        receiptId = uploadData.data.id;
      }

      const debtsToCreate = debtForms.map((form) => ({
        amount: parseFloat(form.amount),
        description: form.description || undefined,
        borrowerId: form.borrowerId,
        groupId,
        receiptIds: receiptId ? [receiptId] : undefined,
      }));

      const result =
        debtsToCreate.length === 1
          ? await createDebt(debtsToCreate[0])
          : await createDebts(debtsToCreate);

      if (!result.success) {
        setFormError(result.error || "Failed to create debt(s)");
        toast.error(result.error || "Failed to create debt(s)");
        return;
      }

      // Create reminders for debts that have alert fields.
      const createdDebts =
        "debts" in result && result.debts
          ? result.debts
          : "debt" in result && result.debt
            ? [result.debt]
            : [];

      for (let i = 0; i < createdDebts.length; i++) {
        const debt = createdDebts[i];
        const debtForm = debtForms[i];

        if (
          debt &&
          debtForm &&
          (debtForm.alertMessage || debtForm.alertDeadline)
        ) {
          try {
            await fetch("/api/alerts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                debtId: debt.id,
                message: debtForm.alertMessage || null,
                deadline: debtForm.alertDeadline || null,
              }),
            });
          } catch (alertError) {
            console.error("Failed to create alert:", alertError);
            // Don't fail the whole operation if alert creation fails.
          }
        }
      }

      toast.success(
        debtForms.length === 1
          ? "Debt created"
          : `${debtForms.length} debts created`
      );
      onOpenChange(false);
      resetForm();
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An error occurred while creating the debt(s)";
      setFormError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Add debts</SheetTitle>
          <SheetDescription>
            Record what group members owe you. Add as many debts as you need —
            they&apos;re created together.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          {formError && (
            <Alert variant="destructive">
              <AlertTitle>Couldn&apos;t create debts</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {/* One receipt for the whole batch */}
          <Field>
            <FieldLabel htmlFor="receipt">Receipt (optional)</FieldLabel>
            <Input
              id="receipt"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleReceiptFileSelect}
            />
            <FieldDescription>
              One receipt is attached to every debt below.
            </FieldDescription>
            {receiptPreview && (
              <div className="mt-2 rounded-md border bg-muted/50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="h-32 w-auto object-contain"
                />
              </div>
            )}
          </Field>

          {debtForms.map((form, index) => (
            <div key={index} className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Debt {index + 1}</div>
                {debtForms.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove debt ${index + 1}`}
                    onClick={() => removeDebtForm(index)}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <DebtFormItem
                debtData={form}
                groupId={groupId}
                currentUserId={currentUserId}
                onChange={(data) => updateDebtForm(index, data)}
                members={memberOptions}
                errors={showValidation ? validateDebtForm(form) : undefined}
                idPrefix={`debt-${index}-`}
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addDebtForm}
          >
            <Plus />
            Add another debt
          </Button>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleCreateDebts} disabled={creating}>
            {creating && <Spinner />}
            Create {debtForms.length} {debtForms.length === 1 ? "debt" : "debts"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
