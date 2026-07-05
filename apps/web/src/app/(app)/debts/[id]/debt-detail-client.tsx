"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  History,
  Receipt,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createDebtTransaction,
  respondToDebtTransaction,
  cancelDebtTransaction,
} from "@/app/(app)/groups/[id]/actions";
import { createConfirmPaidTransaction } from "@/app/(app)/debts/actions";

type Receipt = {
  id: string;
  rawText: string | null;
  createdAt: Date | string;
};

type Alert = {
  id: number;
  message: string | null;
  deadline: Date | string | null;
  isActive: boolean;
  reminderFrequencyDays: number | null;
};

type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date | string;
  lender: {
    id: string;
    email: string;
    name: string | null;
  };
  borrower: {
    id: string;
    email: string;
    name: string | null;
  };
  group: {
    id: number;
    name: string;
  } | null;
  receipts?: Receipt[];
  alert?: Alert | null;
};

type DebtTransaction = {
  id: number;
  type: string;
  status: string;
  lenderApproved: boolean;
  borrowerApproved: boolean;
  proposedAmount: number | null;
  proposedDescription: string | null;
  reason: string | null;
  createdAt: Date | string;
  requester: {
    id: string;
    email: string;
    name: string;
  };
};

type DebtDetailClientProps = {
  debt: Debt;
  receipts: Receipt[];
  transactions: DebtTransaction[];
  currentUserId: string;
  receiptImageUrls: { id: string; url: string }[];
};

function initials(value: string): string {
  const parts = value.split(/[\s._@-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}

const displayName = (p: { name: string | null; email: string }) =>
  p.name || p.email;

export default function DebtDetailClient({
  debt,
  receipts: initialReceipts,
  transactions,
  currentUserId,
  receiptImageUrls,
}: DebtDetailClientProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletionLoading, setDeletionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"drop" | "modify">(
    "drop"
  );
  const [proposedAmount, setProposedAmount] = useState(debt.amount.toString());
  const [proposedDescription, setProposedDescription] = useState(
    debt.description || ""
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Alert modal state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState(debt.alert?.message || "");
  const [alertDeadline, setAlertDeadline] = useState(
    debt.alert?.deadline
      ? new Date(debt.alert.deadline).toISOString().split("T")[0]
      : ""
  );
  const [alertFrequency, setAlertFrequency] = useState<string>(
    debt.alert?.reminderFrequencyDays != null
      ? String(debt.alert.reminderFrequencyDays)
      : "off"
  );
  const [alertSubmitting, setAlertSubmitting] = useState(false);

  // Mark as paid state
  const [markingPaid, setMarkingPaid] = useState(false);

  const isLender = debt.lender.id === currentUserId;
  const isBorrower = debt.borrower.id === currentUserId;
  const pendingTransaction = transactions.find((t) => t.status === "pending");

  // Check if current user needs to approve
  const userNeedsToApprove = pendingTransaction
    ? (isLender && !pendingTransaction.lenderApproved) ||
      (isBorrower && !pendingTransaction.borrowerApproved)
    : false;

  const lenderName = displayName(debt.lender);
  const borrowerName = displayName(debt.borrower);
  const isPaid = debt.status === "paid";

  // Headline + amount color, from the current user's perspective
  const headline = isLender
    ? `${borrowerName} owes you`
    : isBorrower
      ? `You owe ${lenderName}`
      : `${borrowerName} owes ${lenderName}`;
  const amountColor = isPaid
    ? "text-foreground"
    : isLender
      ? "text-emerald-600 dark:text-emerald-400"
      : isBorrower
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  const handleCreateTransaction = async () => {
    setSubmitting(true);
    setError("");

    try {
      const result = await createDebtTransaction({
        debtId: debt.id,
        type: transactionType,
        proposedAmount:
          transactionType === "modify" ? parseFloat(proposedAmount) : undefined,
        proposedDescription:
          transactionType === "modify" ? proposedDescription : undefined,
        reason: reason || undefined,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setShowTransactionModal(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToTransaction = async (approve: boolean) => {
    if (!pendingTransaction) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await respondToDebtTransaction(
        pendingTransaction.id,
        approve
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!pendingTransaction) return;

    setSubmitting(true);
    setError("");

    try {
      const result = await cancelDebtTransaction(pendingTransaction.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Only JPEG, PNG, and WebP are allowed");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File too large. Maximum size is 10MB");
      return;
    }

    setSelectedFile(file);
    setError("");

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("debtIds", debt.id.toString());

      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload receipt");
      }

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh to get updated receipts
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Helper to get image URL for a receipt
  const getReceiptImageUrl = (receiptId: string) => {
    return receiptImageUrls.find((r) => r.id === receiptId)?.url || null;
  };

  // Alert handlers
  const handleSaveAlert = async () => {
    setAlertSubmitting(true);
    setError("");

    try {
      const reminderFrequencyDays =
        alertFrequency === "off" ? null : parseInt(alertFrequency, 10);

      if (debt.alert) {
        // Update existing alert
        const response = await fetch(`/api/alerts/${debt.alert.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: alertMessage || null,
            deadline: alertDeadline || null,
            reminderFrequencyDays,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update alert");
        }
      } else {
        // Create new alert
        const response = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            debtId: debt.id,
            message: alertMessage || null,
            deadline: alertDeadline || null,
            reminderFrequencyDays,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create alert");
        }
      }

      setShowAlertModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save alert");
    } finally {
      setAlertSubmitting(false);
    }
  };

  const handleDeleteAlert = async () => {
    if (!debt.alert) return;

    setAlertSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/alerts/${debt.alert.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete alert");
      }

      setShowAlertModal(false);
      setAlertMessage("");
      setAlertDeadline("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete alert");
    } finally {
      setAlertSubmitting(false);
    }
  };

  const handleMarkAsPaid = async () => {
    setMarkingPaid(true);
    setError("");

    try {
      const result = await createConfirmPaidTransaction(debt.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark as paid");
    } finally {
      setMarkingPaid(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => router.push("/debts")}
          aria-label="Back to debts"
        >
          <ArrowLeft />
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Debt details
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage this debt.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pending request */}
          {pendingTransaction && (
            <Alert className="border-amber-500/40 bg-amber-500/5 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
              <AlertCircle />
              <AlertTitle>
                {pendingTransaction.type === "drop"
                  ? "Deletion request pending"
                  : "Modification request pending"}
              </AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  <p>
                    Requested by {displayName(pendingTransaction.requester)} ·{" "}
                    {pendingTransaction.lenderApproved
                      ? "Lender approved"
                      : "Lender pending"}
                    {" / "}
                    {pendingTransaction.borrowerApproved
                      ? "Borrower approved"
                      : "Borrower pending"}
                  </p>

                  {pendingTransaction.type === "modify" && (
                    <div className="w-full rounded-md border bg-background/60 p-3 text-foreground">
                      <div className="mb-1 font-medium">Proposed changes</div>
                      {pendingTransaction.proposedAmount !== null && (
                        <div className="tabular-nums">
                          Amount: ${debt.amount.toFixed(2)} → $
                          {pendingTransaction.proposedAmount.toFixed(2)}
                        </div>
                      )}
                      {pendingTransaction.proposedDescription !== null && (
                        <div>
                          Description: {debt.description || "(none)"} →{" "}
                          {pendingTransaction.proposedDescription || "(none)"}
                        </div>
                      )}
                    </div>
                  )}

                  {pendingTransaction.reason && (
                    <p>
                      <span className="font-medium text-foreground">
                        Reason:
                      </span>{" "}
                      {pendingTransaction.reason}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {userNeedsToApprove && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleRespondToTransaction(true)}
                          disabled={submitting}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {submitting ? "Processing…" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRespondToTransaction(false)}
                          disabled={submitting}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {pendingTransaction.requester.id === currentUserId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCancelTransaction}
                        disabled={submitting}
                      >
                        Cancel request
                      </Button>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Hero */}
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <AvatarGroup>
                <Avatar
                  size="lg"
                  className={cn(isBorrower && "ring-primary")}
                >
                  <AvatarFallback>{initials(borrowerName)}</AvatarFallback>
                </Avatar>
                <Avatar size="lg" className={cn(isLender && "ring-primary")}>
                  <AvatarFallback>{initials(lenderName)}</AvatarFallback>
                </Avatar>
              </AvatarGroup>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{headline}</p>
                <div
                  className={cn(
                    "text-5xl font-semibold tracking-tight tabular-nums",
                    amountColor
                  )}
                >
                  ${debt.amount.toFixed(2)}
                </div>
                {debt.description && (
                  <p className="text-sm text-muted-foreground">
                    {debt.description}
                  </p>
                )}
              </div>

              <Badge
                variant="outline"
                className={cn(
                  debt.status === "pending" &&
                    "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
                  debt.status === "paid" &&
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                )}
              >
                {debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
              </Badge>

              {!pendingTransaction && debt.status === "pending" && (
                <div className="flex w-full flex-col items-center gap-2 pt-2 sm:max-w-xs">
                  <Button
                    className="w-full"
                    onClick={handleMarkAsPaid}
                    disabled={markingPaid}
                  >
                    {markingPaid ? "Requesting…" : "Mark as paid"}
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowTransactionModal(true)}
                  >
                    Request change
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Both parties must agree to mark as paid or make changes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction History */}
          {transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="size-4 text-muted-foreground" />
                  Transaction history
                </CardTitle>
                <CardDescription>
                  All change requests for this debt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ItemGroup className="gap-2">
                  {transactions.map((transaction) => (
                    <Item key={transaction.id} variant="muted">
                      <ItemMedia>
                        <Avatar>
                          <AvatarFallback>
                            {initials(displayName(transaction.requester))}
                          </AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          {transaction.type === "drop"
                            ? "Delete request"
                            : "Modify request"}
                          <Badge
                            variant="outline"
                            className={cn(
                              transaction.status === "pending" &&
                                "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                              transaction.status === "approved" &&
                                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                              transaction.status === "rejected" &&
                                "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                              transaction.status === "cancelled" &&
                                "border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-300"
                            )}
                          >
                            {transaction.status.charAt(0).toUpperCase() +
                              transaction.status.slice(1)}
                          </Badge>
                        </ItemTitle>
                        <ItemDescription>
                          {displayName(transaction.requester)}
                          {transaction.type === "modify" &&
                            transaction.proposedAmount !== null &&
                            ` · Proposed $${transaction.proposedAmount.toFixed(2)}`}
                          {transaction.reason && ` · ${transaction.reason}`}
                        </ItemDescription>
                      </ItemContent>
                      <div className="shrink-0 self-start text-right text-xs text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </div>
                    </Item>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side rail */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4" />
                  Group
                </span>
                <span className="font-medium">
                  {debt.group?.name ?? "No group"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-4" />
                  Created
                </span>
                <span className="font-medium">
                  {new Date(debt.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Reminder */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="size-4 text-muted-foreground" />
                    Payment reminder
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {debt.alert
                      ? "Reminder set for this debt"
                      : "No reminder set"}
                  </CardDescription>
                </div>
                {isLender && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAlertModal(true)}
                  >
                    {debt.alert ? "Edit" : "Add"}
                  </Button>
                )}
              </div>
            </CardHeader>
            {debt.alert && (
              <CardContent className="space-y-3 text-sm">
                {debt.alert.message && (
                  <div>
                    <div className="text-muted-foreground">Message</div>
                    <p className="mt-0.5">{debt.alert.message}</p>
                  </div>
                )}
                {debt.alert.deadline && (
                  <div>
                    <div className="text-muted-foreground">Deadline</div>
                    <p className="mt-0.5">
                      {new Date(debt.alert.deadline).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <div className="text-muted-foreground">Email reminders</div>
                  <p className="mt-0.5">
                    {debt.alert.reminderFrequencyDays
                      ? `Every ${debt.alert.reminderFrequencyDays} days`
                      : "Off"}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Receipts */}
          {debt.receipts && debt.receipts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="size-4 text-muted-foreground" />
                  Receipts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {debt.receipts.map((receipt) => {
                    const imageUrl = getReceiptImageUrl(receipt.id);
                    return imageUrl ? (
                      <a
                        key={receipt.id}
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block transition-opacity hover:opacity-80"
                      >
                        <img
                          src={imageUrl}
                          alt="Receipt"
                          className="size-24 rounded-md border object-cover"
                        />
                      </a>
                    ) : (
                      <div
                        key={receipt.id}
                        className="flex size-24 items-center justify-center rounded-md border border-dashed bg-muted/50 p-2 text-center"
                      >
                        <p className="text-xs text-muted-foreground">
                          {receipt.id.substring(0, 6)}…
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Upload Receipt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            Upload receipt
          </CardTitle>
          <CardDescription>
            Upload a receipt for this debt (will be linked automatically)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="file">Receipt image</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="block flex-1 text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? "Uploading…" : "Upload"}
              </Button>
              {selectedFile && (
                <Button
                  variant="secondary"
                  onClick={handleReset}
                  disabled={uploading}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {previewUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="relative aspect-video w-64 h-64 overflow-hidden rounded-md border bg-muted">
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="h-64 w-64 object-contain"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Request Modal */}
      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Change</DialogTitle>
              <DialogDescription>
                Request to modify or delete this debt. The other party must
                approve for the change to take effect.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Change Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={transactionType === "drop" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setTransactionType("drop")}
                  >
                    Delete Debt
                  </Button>
                  <Button
                    type="button"
                    variant={
                      transactionType === "modify" ? "default" : "outline"
                    }
                    className="flex-1"
                    onClick={() => setTransactionType("modify")}
                  >
                    Modify Debt
                  </Button>
                </div>
              </div>

              {transactionType === "modify" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="proposedAmount">New Amount</Label>
                    <Input
                      id="proposedAmount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={proposedAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value && !isNaN(parseFloat(value))) {
                          const rounded =
                            Math.round(parseFloat(value) * 100) / 100;
                          setProposedAmount(rounded.toString());
                        } else {
                          setProposedAmount(value);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proposedDescription">New Description</Label>
                    <Input
                      id="proposedDescription"
                      value={proposedDescription}
                      onChange={(e) => setProposedDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you requesting this change?"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setShowTransactionModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTransaction} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Alert Modal */}
      <Dialog open={showAlertModal} onOpenChange={setShowAlertModal}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {debt.alert ? "Edit Alert" : "Add Alert"}
              </DialogTitle>
              <DialogDescription>
                Set a reminder for this debt with an optional message and deadline.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alertMessage">Message (optional)</Label>
                <Textarea
                  id="alertMessage"
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  placeholder="e.g., Please pay by end of month"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alertDeadline">Deadline (optional)</Label>
                <Input
                  id="alertDeadline"
                  type="date"
                  value={alertDeadline}
                  onChange={(e) => setAlertDeadline(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alertFrequency">Email reminder frequency</Label>
                <Select
                  value={alertFrequency}
                  onValueChange={setAlertFrequency}
                >
                  <SelectTrigger id="alertFrequency">
                    <SelectValue placeholder="Off" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off (no email reminders)</SelectItem>
                    <SelectItem value="7">Weekly (every 7 days)</SelectItem>
                    <SelectItem value="14">Biweekly (every 14 days)</SelectItem>
                    <SelectItem value="30">Monthly (every 30 days)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The borrower receives an email reminder on this cadence.
                </p>
              </div>
            </div>

            <DialogFooter>
              {debt.alert && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteAlert}
                  disabled={alertSubmitting}
                >
                  Delete Alert
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => setShowAlertModal(false)}
                disabled={alertSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveAlert} disabled={alertSubmitting}>
                {alertSubmitting ? "Saving…" : "Save alert"}
              </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
