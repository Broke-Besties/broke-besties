"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createDebtTransaction,
  respondToDebtTransaction,
  cancelDebtTransaction,
} from "@/app/groups/[id]/actions";
import { createConfirmPaidTransaction } from "@/app/debts/actions";

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
  };
  borrower: {
    id: string;
    email: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  console.log("[Debt Detail Client] Receipt data:", {
    receiptsCount: debt.receipts?.length || 0,
    receiptImageUrlsCount: receiptImageUrls.length,
  });

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
      if (debt.alert) {
        // Update existing alert
        const response = await fetch(`/api/alerts/${debt.alert.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: alertMessage || null,
            deadline: alertDeadline || null,
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Debt details
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage debt information
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Pending Transaction Banner */}
      {pendingTransaction && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">
                  {pendingTransaction.type === "drop"
                    ? "Deletion Request Pending"
                    : "Modification Request Pending"}
                </CardTitle>
                <CardDescription className="mt-1">
                  Requested by {pendingTransaction.requester.email}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                Awaiting approval
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingTransaction.type === "modify" && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <div className="font-medium mb-2">Proposed changes:</div>
                {pendingTransaction.proposedAmount !== null && (
                  <div>
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
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Reason:</span>{" "}
                {pendingTransaction.reason}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Status:</span>{" "}
              {pendingTransaction.lenderApproved
                ? "Lender approved"
                : "Lender pending"}
              {" / "}
              {pendingTransaction.borrowerApproved
                ? "Borrower approved"
                : "Borrower pending"}
            </div>
            <div className="flex gap-2">
              {userNeedsToApprove && (
                <>
                  <Button
                    onClick={() => handleRespondToTransaction(true)}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {submitting ? "Processing..." : "Approve"}
                  </Button>
                  <Button
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
                  variant="secondary"
                  onClick={handleCancelTransaction}
                  disabled={submitting}
                >
                  Cancel Request
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debt Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">
                ${debt.amount.toFixed(2)}
              </CardTitle>
              <CardDescription className="mt-2">
                {isLender ? (
                  <>
                    Lending to <strong>{debt.borrower.email}</strong>
                  </>
                ) : (
                  <>
                    Borrowing from <strong>{debt.lender.email}</strong>
                  </>
                )}
              </CardDescription>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {/* Left side - Debt details */}
            <div className="flex-1 space-y-4">
              {debt.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{debt.description}</p>
                </div>
              )}
              {debt.group && (
                <div>
                  <Label className="text-muted-foreground">Group</Label>
                  <p className="mt-1">{debt.group.name}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="mt-1">
                  {new Date(debt.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Action Buttons */}
              {!pendingTransaction && debt.status === "pending" && (
                <div className="pt-4 border-t space-y-3">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleMarkAsPaid}
                      disabled={markingPaid}
                    >
                      {markingPaid ? "Requesting..." : "Mark as Paid"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowTransactionModal(true)}
                    >
                      Request Change
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Both parties must agree to mark as paid or make changes.
                  </p>
                </div>
              )}
            </div>

            {/* Right side - Receipts */}
            {debt.receipts && debt.receipts.length > 0 && (
              <div className="shrink-0 space-y-2">
                <Label className="text-muted-foreground">Receipts</Label>
                <div className="flex flex-wrap gap-2">
                  {debt.receipts.map((receipt) => {
                    const imageUrl = getReceiptImageUrl(receipt.id);
                    return (
                      <div key={receipt.id}>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt="Receipt"
                            className="w-32 h-32 object-contain rounded-md border"
                          />
                        ) : (
                          <div className="w-32 h-32 rounded-md border border-dashed bg-muted/50 p-2 text-center flex items-center justify-center">
                            <p className="text-xs text-muted-foreground">
                              Receipt {receipt.id.substring(0, 6)}...
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Payment Reminder</CardTitle>
              <CardDescription>
                {debt.alert
                  ? "Alert settings for this debt"
                  : "No reminder set for this debt"}
              </CardDescription>
            </div>
            {isLender && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAlertModal(true)}
              >
                {debt.alert ? "Edit Alert" : "Add Alert"}
              </Button>
            )}
          </div>
        </CardHeader>
        {debt.alert && (
          <CardContent className="space-y-2">
            {debt.alert.message && (
              <div>
                <Label className="text-muted-foreground">Message</Label>
                <p className="mt-1">{debt.alert.message}</p>
              </div>
            )}
            {debt.alert.deadline && (
              <div>
                <Label className="text-muted-foreground">Deadline</Label>
                <p className="mt-1">
                  {new Date(debt.alert.deadline).toLocaleDateString()}
                </p>
              </div>
            )}
            {!debt.alert.message && !debt.alert.deadline && (
              <p className="text-sm text-muted-foreground">
                Alert is set but no message or deadline configured.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All change requests for this debt</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-lg border bg-muted/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {transaction.type === "drop"
                            ? "Delete Request"
                            : "Modify Request"}
                        </span>
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
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Requested by {transaction.requester.email}
                      </div>
                      {transaction.type === "modify" &&
                        transaction.proposedAmount !== null && (
                          <div className="text-sm">
                            Proposed amount: $
                            {transaction.proposedAmount.toFixed(2)}
                          </div>
                        )}
                      {transaction.reason && (
                        <div className="text-sm text-muted-foreground">
                          Reason: {transaction.reason}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-sm text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                      <div className="text-xs">
                        {new Date(transaction.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Receipt */}
      <Card>
        <CardHeader>
          <CardTitle>Upload receipt</CardTitle>
          <CardDescription>
            Upload a receipt for this debt (will be linked automatically)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="file">Receipt image</Label>
            <div className="flex gap-2">
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
      {showTransactionModal && (
        <>
          <DialogOverlay onClick={() => setShowTransactionModal(false)} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Change</DialogTitle>
              <DialogDescription>
                Request to modify or delete this debt. The other party must
                approve for the change to take effect.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 pt-0 space-y-4">
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
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </>
      )}

      {/* Alert Modal */}
      {showAlertModal && (
        <>
          <DialogOverlay onClick={() => setShowAlertModal(false)} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {debt.alert ? "Edit Alert" : "Add Alert"}
              </DialogTitle>
              <DialogDescription>
                Set a reminder for this debt with an optional message and deadline.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 pt-0 space-y-4">
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
                {alertSubmitting ? "Saving..." : "Save Alert"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </>
      )}
    </div>
  );
}
