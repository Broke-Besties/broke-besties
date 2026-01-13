import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { receiptService } from "@/services/receipt.service";

// POST /api/receipts/upload - Upload and parse receipt
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const debtIdsStr = formData.get("debtIds") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!debtIdsStr) {
      return NextResponse.json(
        { error: "debtIds is required" },
        { status: 400 }
      );
    }

    // Parse debtIds - can be comma-separated or JSON array
    let debtIds: number[];
    try {
      if (debtIdsStr.startsWith("[")) {
        debtIds = JSON.parse(debtIdsStr);
      } else {
        debtIds = debtIdsStr.split(",").map((id) => parseInt(id.trim(), 10));
      }

      if (!Array.isArray(debtIds) || debtIds.length === 0) {
        throw new Error("Invalid debtIds format");
      }

      if (debtIds.some((id) => isNaN(id))) {
        throw new Error("Invalid debt ID in array");
      }
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid debtIds format. Provide comma-separated IDs or JSON array",
        },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    const result = await receiptService.uploadAndParseReceipt(
      file,
      debtIds,
      user.id
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error uploading receipt:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
