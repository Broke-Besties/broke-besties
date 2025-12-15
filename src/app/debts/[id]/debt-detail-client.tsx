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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
};

type Receipt = {
  id: string;
  debtId: number;
  rawText: string | null;
  createdAt: Date | string;
};

type DebtDetailClientProps = {
  debt: Debt;
  receipts: Receipt[];
  currentUserId: string;
};

export default function DebtDetailClient({
  debt,
  receipts: initialReceipts,
  currentUserId,
}: DebtDetailClientProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isLender = debt.lender.id === currentUserId;

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
        </CardContent>
      </Card>

      {/* Receipts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Receipt */}
        <Card>
          <CardHeader>
            <CardTitle>Upload receipt</CardTitle>
            <CardDescription>
              Upload a receipt image to extract text with AI
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
              All uploaded receipts for this debt
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
    </div>
  );
}
