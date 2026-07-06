"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export type AlertWithRelations = {
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

export const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "off", label: "Off (no email reminders)" },
  { value: "7", label: "Weekly (every 7 days)" },
  { value: "14", label: "Biweekly (every 14 days)" },
  { value: "30", label: "Monthly (every 30 days)" },
];

export function frequencyLabel(days: number | null): string {
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
} {
  if (alert.debt) {
    return {
      amount: alert.debt.amount,
      description: alert.debt.description,
      link: `/debts/${alert.debt.id}`,
    };
  }
  if (alert.recurringPayment) {
    return {
      amount: alert.recurringPayment.amount,
      description: alert.recurringPayment.description,
      link: `/recurring-payments/${alert.recurringPayment.id}`,
    };
  }
  return { amount: 0, description: null, link: null };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LenderAlertRow({
  alert,
  pending,
  onFrequencyChange,
}: {
  alert: AlertWithRelations;
  pending: boolean;
  onFrequencyChange: (alertId: number, newValue: string) => void;
}) {
  const meta = describeAlert(alert);
  const currentValue =
    alert.reminderFrequencyDays != null
      ? String(alert.reminderFrequencyDays)
      : "off";
  const details = [
    `Borrower: ${alert.borrower.name} (${alert.borrower.email})`,
    alert.message ? `Note: ${alert.message}` : null,
    alert.deadline ? `Due ${formatDate(alert.deadline)}` : null,
  ].filter(Boolean);

  return (
    <Item variant="outline">
      <ItemMedia>
        <Avatar>
          <AvatarFallback>{initials(alert.borrower.name)}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="tabular-nums">${meta.amount.toFixed(2)}</span>
          {meta.description && (
            <span className="font-normal text-muted-foreground">
              — {meta.description}
            </span>
          )}
        </ItemTitle>
        <ItemDescription>{details.join(" · ")}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {pending && <Spinner className="text-muted-foreground" />}
        <Select
          value={currentValue}
          onValueChange={(value) => onFrequencyChange(alert.id, value)}
          disabled={pending}
        >
          <SelectTrigger
            size="sm"
            className="w-44"
            aria-label="Email reminder frequency"
          >
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
        {meta.link && (
          <Button asChild variant="outline" size="sm">
            <Link href={meta.link}>View</Link>
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

export function BorrowerAlertRow({
  alert,
  pending,
  onOptOut,
}: {
  alert: AlertWithRelations;
  pending: boolean;
  onOptOut: (alertId: number) => void;
}) {
  const meta = describeAlert(alert);
  const details = [
    `Lender: ${alert.lender.name} (${alert.lender.email})`,
    alert.message ? `Note: ${alert.message}` : null,
    alert.deadline ? `Due ${formatDate(alert.deadline)}` : null,
  ].filter(Boolean);

  return (
    <Item variant="outline">
      <ItemMedia>
        <Avatar>
          <AvatarFallback>{initials(alert.lender.name)}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="tabular-nums">${meta.amount.toFixed(2)}</span>
          {meta.description && (
            <span className="font-normal text-muted-foreground">
              — {meta.description}
            </span>
          )}
          <Badge variant="outline">
            {frequencyLabel(alert.reminderFrequencyDays)}
          </Badge>
        </ItemTitle>
        <ItemDescription>{details.join(" · ")}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {meta.link && (
          <Button asChild variant="outline" size="sm">
            <Link href={meta.link}>View</Link>
          </Button>
        )}
        {alert.reminderFrequencyDays != null && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOptOut(alert.id)}
            disabled={pending}
          >
            {pending && <Spinner />}
            Stop emails
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
