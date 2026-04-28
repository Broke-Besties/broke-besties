import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";

// POST /api/alerts/[id]/opt-out - Borrower disables email reminders for this alert
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const alertId = parseInt(id, 10);

    if (isNaN(alertId)) {
      return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
    }

    const alert = await alertService.optOutOfReminders(alertId, user.id);

    return NextResponse.json({
      message: "Email reminders disabled for this alert",
      alert,
    });
  } catch (error) {
    console.error("Error opting out of alert reminders:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found")
      ? 404
      : message.includes("Only the borrower")
      ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
