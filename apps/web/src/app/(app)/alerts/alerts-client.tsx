"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import {
  BorrowerAlertRow,
  LenderAlertRow,
  type AlertWithRelations,
} from "./alert-row";

type AlertsPageClientProps = {
  lenderAlerts: AlertWithRelations[];
  borrowerAlerts: AlertWithRelations[];
  currentUserId: string;
};

export default function AlertsPageClient({
  lenderAlerts,
  borrowerAlerts,
  currentUserId,
}: AlertsPageClientProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleFrequencyChange = async (alertId: number, newValue: string) => {
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
      toast.success(
        reminderFrequencyDays == null
          ? "Email reminders turned off"
          : "Reminder frequency updated"
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update frequency"
      );
    } finally {
      setPendingId(null);
    }
  };

  const handleOptOut = async (alertId: number) => {
    setPendingId(alertId);
    try {
      const response = await fetch(`/api/alerts/${alertId}/opt-out`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to opt out");
      }
      toast.success("You won't receive emails about this alert anymore");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to opt out");
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
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Manage how often we email reminders for your debts and recurring payments."
      />

      <Card>
        <CardHeader>
          <CardTitle>Alerts you created</CardTitle>
          <CardDescription>
            You set the cadence; the borrower receives the email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lenderAlerts.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellRing />
                </EmptyMedia>
                <EmptyTitle>No alerts yet</EmptyTitle>
                <EmptyDescription>
                  Add a payment reminder to one of your debts and it will show
                  up here.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="outline">
                  <Link href="/debts">Go to your debts</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">
              {lenderAlerts.map((alert) => (
                <LenderAlertRow
                  key={alert.id}
                  alert={alert}
                  pending={pendingId === alert.id}
                  onFrequencyChange={handleFrequencyChange}
                />
              ))}
            </ItemGroup>
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
        <CardContent>
          {borrowerOnly.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellOff />
                </EmptyMedia>
                <EmptyTitle>No reminders target you</EmptyTitle>
                <EmptyDescription>
                  No one is sending you reminder emails right now.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">
              {borrowerOnly.map((alert) => (
                <BorrowerAlertRow
                  key={alert.id}
                  alert={alert}
                  pending={pendingId === alert.id}
                  onOptOut={handleOptOut}
                />
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
