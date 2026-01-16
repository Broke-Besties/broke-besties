import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { receiptService } from "@/services/receipt.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// DELETE /api/receipts/[id] - Delete a receipt
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

