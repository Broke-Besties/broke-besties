import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { receiptService } from "@/services/receipt.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorStatus(message: string) {
  if (message === "Receipt not found") return 404;
  if (message.startsWith("Access denied")) return 403;
  return 500;
}

// PATCH /api/receipts/[id] - Link receipt to debts
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const debtIds = body?.debtIds;

    if (!debtIds || !Array.isArray(debtIds) || debtIds.length === 0) {
      return NextResponse.json(
        { error: "debtIds array is required" },
        { status: 400 }
      );
    }

    if (!debtIds.every(Number.isInteger)) {
      return NextResponse.json({ error: "Invalid debt ID" }, { status: 400 });
    }

    await receiptService.linkReceiptToDebts(id, debtIds, user.id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error linking receipt to debts:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

// DELETE /api/receipts/[id] - Delete a receipt
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await receiptService.deleteReceipt(id, user.id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting receipt:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
