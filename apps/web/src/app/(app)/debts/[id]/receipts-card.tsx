"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { ReceiptRecord } from "./types";

export function ReceiptsCard({
  debtId,
  receipts,
  receiptImageUrls,
}: {
  debtId: number;
  receipts: ReceiptRecord[];
  receiptImageUrls: { id: string; url: string }[];
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const getReceiptImageUrl = (receiptId: string) =>
    receiptImageUrls.find((r) => r.id === receiptId)?.url || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, and WebP are allowed");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 10MB");
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("debtIds", debtId.toString());

      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload receipt");
      }

      handleReset();
      toast.success("Receipt uploaded");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload receipt"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="size-4 text-muted-foreground" />
          Receipts
        </CardTitle>
        <CardDescription>
          Attach receipt images to this debt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {receipts.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No receipts</EmptyTitle>
              <EmptyDescription>
                Upload a receipt to keep proof with this debt.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {receipts.map((receipt) => {
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
        )}

        {/* Compact upload zone */}
        <label
          htmlFor="receipt-upload"
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-4 text-center transition-colors hover:bg-muted/50"
        >
          <Upload className="size-4 text-muted-foreground" />
          <span className="text-sm">
            {selectedFile ? selectedFile.name : "Choose an image to upload"}
          </span>
          <span className="text-xs text-muted-foreground">
            JPEG, PNG or WebP · max 10MB
          </span>
          <input
            ref={fileInputRef}
            id="receipt-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="sr-only"
          />
        </label>

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Receipt preview"
            className="h-32 w-full rounded-md border bg-muted object-contain"
          />
        )}

        {selectedFile && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading && <Spinner />}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={uploading}
            >
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
