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

type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  receiptId: string | null;
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
  receipt?: {
    id: string;
    rawText: string | null;
  } | null;
};

type Receipt = {
  id: string;
  groupId: number;
  rawText: string | null;
  createdAt: Date | string;
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
};

export default function DebtDetailClient({
  debt,
  receipts: initialReceipts,
  transactions,
  currentUserId,
}: DebtDetailClientProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"drop" | "modify">("drop");
  const [proposedAmount, setProposedAmount] = useState(debt.amount.toString());
  const [proposedDescription, setProposedDescription] = useState(debt.description || "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        proposedAmount: transactionType === "modify" ? parseFloat(proposedAmount) : undefined,
        proposedDescription: transactionType === "modify" ? proposedDescription : undefined,
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
      const result = await respondToDebtTransaction(pendingTransaction.id, approve);

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
      formData.append("groupId", debt.group!.id.toString());
      formData.append("debtId", debt.id.toString());

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
              {pendingTransaction.lenderApproved ? "Lender approved" : "Lender pending"}
              {" / "}
              {pendingTransaction.borrowerApproved ? "Borrower approved" : "Borrower pending"}
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
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                debt.status === "not_paying" &&
                  "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              )}
            >
              {debt.status === "not_paying"
                ? "Not paying"
                : debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {debt.receipt && (
            <div>
              <Label className="text-muted-foreground">Linked Receipt</Label>
              <div className="mt-1 rounded-md border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">
                  Receipt ID: {debt.receipt.id.substring(0, 8)}...
                </div>
                {debt.receipt.rawText && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {debt.receipt.rawText.substring(0, 100)}
                    {debt.receipt.rawText.length > 100 ? "..." : ""}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Request Change Button */}
          {!pendingTransaction && (
            <div className="pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setShowTransactionModal(true)}
              >
                Request Change
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Request to modify or delete this debt. Both parties must agree.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              All change requests for this debt
            </CardDescription>
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
                          {transaction.type === "drop" ? "Delete Request" : "Modify Request"}
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
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Requested by {transaction.requester.email}
                      </div>
                      {transaction.type === "modify" && transaction.proposedAmount !== null && (
                        <div className="text-sm">
                          Proposed amount: ${transaction.proposedAmount.toFixed(2)}
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

      {/* Receipts Section */}
      <div className="grid gap-6 md:grid-cols-2">
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
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>

            {previewUrl && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex-1"
              >
                {uploading ? "Processing…" : "Upload & parse"}
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
          </CardContent>
        </Card>

        {/* Receipts List */}
        <Card>
          <CardHeader>
            <CardTitle>Receipts ({receipts.length})</CardTitle>
            <CardDescription>
              All uploaded receipts for this group
            </CardDescription>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No receipts uploaded yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="rounded-lg border bg-muted/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground">
                          {new Date(receipt.createdAt).toLocaleString()}
                        </div>
                        {receipt.rawText && (
                          <pre className="mt-2 whitespace-pre-wrap text-xs">
                            {receipt.rawText.substring(0, 150)}
                            {receipt.rawText.length > 150 ? "..." : ""}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                    variant={transactionType === "modify" ? "default" : "outline"}
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
                      onChange={(e) => setProposedAmount(e.target.value)}
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
    </div>
  );
}
