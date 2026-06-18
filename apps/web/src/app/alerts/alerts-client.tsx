"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AlertWithRelations = {
  id: number;
  message: string | null;
  deadline: Date | string | null;
  isActive: boolean;
  reminderFrequencyDays: number | null;
  lastReminderSentAt: Date | string | null;
  lender: { id: string; email: string; name: string };
  borrower: { id: string; email: string; name: string };
  debt: {
    id: number;
    amount: number;
    description: string | null;
    status: string;
  } | null;
  recurringPayment: {
    id: number;
    amount: number;
    description: string | null;
    status: string;
  } | null;
  group: { id: number; name: string } | null;
};

type AlertsPageClientProps = {
  lenderAlerts: AlertWithRelations[];
  borrowerAlerts: AlertWithRelations[];
  currentUserId: string;
};

const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "off", label: "Off (no email reminders)" },
  { value: "7", label: "Weekly (every 7 days)" },
  { value: "14", label: "Biweekly (every 14 days)" },
  { value: "30", label: "Monthly (every 30 days)" },
];

function frequencyLabel(days: number | null): string {
  if (days == null) return "Off";
  if (days === 7) return "Weekly";
  if (days === 14) return "Biweekly";
  if (days === 30) return "Monthly";
  return `Every ${days} days`;
}

function describeAlert(alert: AlertWithRelations): {
  amount: number;
  description: string | null;
  link: string | null;
  kind: "debt" | "recurring";
} {
  if (alert.debt) {
    return {
      amount: alert.debt.amount,
      description: alert.debt.description,
      link: `/debts/${alert.debt.id}`,
      kind: "debt",
    };
  }
  return {
    amount: alert.recurringPayment?.amount ?? 0,
    description: alert.recurringPayment?.description ?? null,
    link: null,
    kind: "recurring",
  };
}

export default function AlertsPageClient({
  lenderAlerts,
  borrowerAlerts,
  currentUserId,
}: AlertsPageClientProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleFrequencyChange = async (alertId: number, newValue: string) => {
    setError("");
    setPendingId(alertId);
    try {
      const reminderFrequencyDays =
        newValue === "off" ? null : parseInt(newValue, 10);
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderFrequencyDays }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update frequency");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPendingId(null);
    }
  };

  const handleOptOut = async (alertId: number) => {
    setError("");
    setPendingId(alertId);
    try {
      const response = await fetch(`/api/alerts/${alertId}/opt-out`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to opt out");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to opt out");
    } finally {
      setPendingId(null);
    }
  };

  // Borrower view should hide alerts where the current user is also the lender
  // (those already appear in the "Alerts you created" section).
  const borrowerOnly = borrowerAlerts.filter(
    (a) => a.lender.id !== currentUserId
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Alert email settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage how often we email reminders for your debts and recurring
            payments.
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

      <Card>
        <CardHeader>
          <CardTitle>Alerts you created</CardTitle>
          <CardDescription>
            You set the cadence; the borrower receives the email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lenderAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t created any alerts yet.
            </p>
          ) : (
            lenderAlerts.map((alert) => {
              const meta = describeAlert(alert);
              const currentValue =
                alert.reminderFrequencyDays != null
                  ? String(alert.reminderFrequencyDays)
                  : "off";
              return (
                <div
                  key={alert.id}
                  className="rounded-lg border bg-muted/30 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium">
                        ${meta.amount.toFixed(2)}
                        {meta.description ? ` — ${meta.description}` : ""}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Borrower: {alert.borrower.name} ({alert.borrower.email})
                      </div>
                      {alert.message && (
                        <div className="text-sm text-muted-foreground">
                          Note: {alert.message}
                        </div>
                      )}
                      {alert.deadline && (
                        <div className="text-sm text-muted-foreground">
                          Deadline:{" "}
                          {new Date(alert.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    {meta.link && (
                      <Link
                        href={meta.link}
                        className="shrink-0 text-sm text-primary hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`freq-${alert.id}`}>
                      Email reminder frequency
                    </Label>
                    <Select
                      value={currentValue}
                      onValueChange={(v) => handleFrequencyChange(alert.id, v)}
                      disabled={pendingId === alert.id}
                    >
                      <SelectTrigger id={`freq-${alert.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alerts targeting you</CardTitle>
          <CardDescription>
            Reminders other people set on debts you owe. You can stop receiving
            emails for any of these.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {borrowerOnly.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one is sending you reminder emails right now.
            </p>
          ) : (
            borrowerOnly.map((alert) => {
              const meta = describeAlert(alert);
              return (
                <div
                  key={alert.id}
                  className="rounded-lg border bg-muted/30 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium">
                        ${meta.amount.toFixed(2)}
                        {meta.description ? ` — ${meta.description}` : ""}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Lender: {alert.lender.name} ({alert.lender.email})
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Cadence: {frequencyLabel(alert.reminderFrequencyDays)}
                      </div>
                      {alert.message && (
                        <div className="text-sm text-muted-foreground">
                          Note: {alert.message}
                        </div>
                      )}
                    </div>
                    {meta.link && (
                      <Link
                        href={meta.link}
                        className="shrink-0 text-sm text-primary hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </div>
                  {alert.reminderFrequencyDays != null && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOptOut(alert.id)}
                      disabled={pendingId === alert.id}
                    >
                      {pendingId === alert.id
                        ? "Updating..."
                        : "Stop emailing me about this"}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
