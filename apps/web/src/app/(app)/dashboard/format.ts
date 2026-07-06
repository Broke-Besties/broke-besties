import type { RecurringPayment } from "./types";

export function getNextRenewalDate(payment: RecurringPayment): Date {
  const created = new Date(payment.createdAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSinceCreated = Math.floor(
    (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );
  const periodsElapsed = Math.max(
    0,
    Math.ceil(daysSinceCreated / payment.frequency)
  );
  const nextRenewal = new Date(created);
  nextRenewal.setDate(created.getDate() + periodsElapsed * payment.frequency);

  // If next renewal is today or in the past, add one more period
  if (nextRenewal <= today) {
    nextRenewal.setDate(nextRenewal.getDate() + payment.frequency);
  }

  return nextRenewal;
}

export function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
