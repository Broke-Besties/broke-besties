import { NextRequest, NextResponse } from "next/server";
import { alertService } from "@/services/alert.service";
import { emailService } from "@/services/email.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/alert-reminders
// Triggered by GitHub Actions on a daily schedule.
// Auth: Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/alert-reminders] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const manageAlertsLink = `${appUrl}/alerts`;

  const dueAlerts = await alertService.getAlertsDueForReminder(now);

  let sent = 0;
  let failed = 0;
  const errors: { alertId: number; error: string }[] = [];

  for (const alert of dueAlerts) {
    const amount =
      alert.debt?.amount ?? alert.recurringPayment?.amount ?? 0;
    const description =
      alert.debt?.description ?? alert.recurringPayment?.description ?? null;
    const debtId = alert.debt?.id;
    const debtLink = debtId ? `${appUrl}/debts/${debtId}` : `${appUrl}/dashboard`;

    const result = await emailService.sendAlertReminder({
      to: alert.borrower.email,
      borrowerName: alert.borrower.name,
      lenderName: alert.lender.name,
      amount,
      description,
      message: alert.message,
      deadline: alert.deadline,
      groupName: alert.group?.name ?? null,
      debtLink,
      manageAlertsLink,
    });

    if (result.success) {
      sent += 1;
      try {
        await alertService.markReminderSent(alert.id, now);
      } catch (err) {
        console.error(
          `[cron/alert-reminders] Failed to mark alert ${alert.id} as sent:`,
          err
        );
      }
    } else {
      failed += 1;
      errors.push({ alertId: alert.id, error: result.error || "Unknown error" });
    }
  }

  console.log("[cron/alert-reminders] Run complete", {
    total: dueAlerts.length,
    sent,
    failed,
  });

  return NextResponse.json({
    total: dueAlerts.length,
    sent,
    failed,
    errors,
  });
}
