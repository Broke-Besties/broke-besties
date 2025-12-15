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
    const groupIdStr = formData.get("groupId") as string;
    const debtIdStr = formData.get("debtId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!groupIdStr) {
      return NextResponse.json(
        { error: "groupId is required" },
        { status: 400 }
      );
    }

    const groupId = parseInt(groupIdStr, 10);
    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: "Invalid groupId" },
        { status: 400 }
      );
    }

    // Optional debtId
    let debtId: number | undefined;
    if (debtIdStr) {
      debtId = parseInt(debtIdStr, 10);
      if (isNaN(debtId)) {
        return NextResponse.json(
          { error: "Invalid debtId" },
          { status: 400 }
        );
      }
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
      groupId,
      user.id,
      debtId
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
