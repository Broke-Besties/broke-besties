export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function endOfWeek(date: Date): Date {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function allDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function shiftAllDayKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatEventRange(
  startsAt: string,
  endsAt: string,
  allDay: boolean,
): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (allDay) {
    const days = Math.max(
      1,
      Math.round(
        (Date.parse(`${allDayKey(endsAt)}T00:00:00.000Z`) -
          Date.parse(`${allDayKey(startsAt)}T00:00:00.000Z`)) /
          86400000,
      ),
    );
    return days === 1 ? "All day" : `All day · ${days} days`;
  }
  const sameDay = isSameDay(start, end);
  if (sameDay) {
    return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
  }
  return `${start.toLocaleDateString()} ${formatTime(startsAt)} – ${end.toLocaleDateString()} ${formatTime(endsAt)}`;
}

export function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function toDateInput(iso: string): string {
  return toDateTimeLocal(iso).slice(0, 10);
}

export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function fromDateInput(value: string, addDay = false): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (addDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function defaultEventTimes(day: Date): { start: string; end: string } {
  const start = new Date(day);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setHours(19, 0, 0, 0);
  return {
    start: toDateTimeLocal(start.toISOString()),
    end: toDateTimeLocal(end.toISOString()),
  };
}
