"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { DebtAlert } from "./types";

export function ReminderCard({
  debtId,
  alert,
  isLender,
}: {
  debtId: number;
  alert: DebtAlert | null;
  isLender: boolean;
}) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState(alert?.message || "");
  const [deadline, setDeadline] = useState(
    alert?.deadline
      ? new Date(alert.deadline).toISOString().split("T")[0]
      : ""
  );
  const [frequency, setFrequency] = useState<string>(
    alert?.reminderFrequencyDays != null
      ? String(alert.reminderFrequencyDays)
      : "off"
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);

    try {
      const reminderFrequencyDays =
        frequency === "off" ? null : parseInt(frequency, 10);
      const body = JSON.stringify({
        ...(alert ? {} : { debtId }),
        message: message || null,
        deadline: deadline || null,
        reminderFrequencyDays,
      });

      const response = alert
        ? await fetch(`/api/alerts/${alert.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body,
          })
        : await fetch("/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || (alert ? "Failed to update reminder" : "Failed to create reminder")
        );
      }

      toast.success(alert ? "Reminder updated" : "Reminder set");
      setShowDialog(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save reminder"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!alert) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete reminder");
      }

      toast.success("Reminder deleted");
      setShowDialog(false);
      setMessage("");
      setDeadline("");
      setFrequency("off");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete reminder"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-muted-foreground" />
              Payment reminder
            </CardTitle>
            <CardDescription className="mt-1">
              {alert
                ? "Reminder set for this debt"
                : isLender
                  ? "No reminder set"
                  : "Only the lender can manage reminders"}
            </CardDescription>
          </div>
          {isLender && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDialog(true)}
            >
              {alert ? "Edit" : "Add"}
            </Button>
          )}
        </div>
      </CardHeader>
      {alert && (
        <CardContent className="space-y-3 text-sm">
          {alert.message && (
            <div>
              <div className="text-muted-foreground">Message</div>
              <p className="mt-0.5">{alert.message}</p>
            </div>
          )}
          {alert.deadline && (
            <div>
              <div className="text-muted-foreground">Deadline</div>
              <p className="mt-0.5">
                {new Date(alert.deadline).toLocaleDateString()}
              </p>
            </div>
          )}
          <div>
            <div className="text-muted-foreground">Email reminders</div>
            <p className="mt-0.5">
              {alert.reminderFrequencyDays
                ? `Every ${alert.reminderFrequencyDays} days`
                : "Off"}
            </p>
          </div>
        </CardContent>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {alert ? "Edit reminder" : "Add reminder"}
            </DialogTitle>
            <DialogDescription>
              Set a reminder for this debt with an optional message and
              deadline.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="reminderMessage">
              Message (optional)
            </FieldLabel>
            <Textarea
              id="reminderMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., Please pay by end of month"
              rows={3}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="reminderDeadline">
              Deadline (optional)
            </FieldLabel>
            <Input
              id="reminderDeadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="reminderFrequency">
              Email reminder frequency
            </FieldLabel>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="reminderFrequency">
                <SelectValue placeholder="Off" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off (no email reminders)</SelectItem>
                <SelectItem value="7">Weekly (every 7 days)</SelectItem>
                <SelectItem value="14">Biweekly (every 14 days)</SelectItem>
                <SelectItem value="30">Monthly (every 30 days)</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              The borrower receives an email reminder on this cadence.
            </FieldDescription>
          </Field>

          <DialogFooter>
            {alert && (
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
              >
                Delete reminder
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Spinner />}
              {submitting ? "Saving…" : "Save reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              The reminder and its email schedule will be removed. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                handleDelete();
              }}
            >
              Delete reminder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
