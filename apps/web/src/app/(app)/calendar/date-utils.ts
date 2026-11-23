export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function offsetAt(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock value (`YYYY-MM-DDTHH:mm`) in `timeZone` to an ISO
 * instant. Handles DST by re-checking the offset at the resolved instant.
 */
export function zonedDateTimeToUtc(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) throw new Error("Invalid date/time");

  const [, year, month, day, hour, minute] = match.map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = offsetAt(new Date(asUtc), timeZone);
  let timestamp = asUtc - firstOffset;
  const secondOffset = offsetAt(new Date(timestamp), timeZone);
  if (secondOffset !== firstOffset) {
    timestamp = asUtc - secondOffset;
  }
  return new Date(timestamp).toISOString();
}

export function isoToZonedDateTimeLocal(iso: string, timeZone: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function zonedDayKey(iso: string, timeZone: string): string {
  const parts = zonedParts(new Date(iso), timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function zonedDayRange(
  key: string,
  timeZone: string,
): { start: number; end: number } {
  const start = Date.parse(
    zonedDateTimeToUtc(`${key}T00:00`, timeZone),
  );
  const end = Date.parse(
    zonedDateTimeToUtc(`${shiftAllDayKey(key, 1)}T00:00`, timeZone),
  );
  return { start, end };
}

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

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateShort(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
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
  timeZone: string,
): string {
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

  if (zonedDayKey(startsAt, timeZone) === zonedDayKey(endsAt, timeZone)) {
    return `${formatTime(startsAt, timeZone)} – ${formatTime(endsAt, timeZone)}`;
  }
  return `${formatDateShort(startsAt, timeZone)} ${formatTime(startsAt, timeZone)} – ${formatDateShort(endsAt, timeZone)} ${formatTime(endsAt, timeZone)}`;
}

export function toDateTimeLocal(iso: string, timeZone: string): string {
  return isoToZonedDateTimeLocal(iso, timeZone);
}

export function fromDateTimeLocal(value: string, timeZone: string): string {
  return zonedDateTimeToUtc(value, timeZone);
}

export function fromDateInput(value: string, addDay = false): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (addDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function defaultEventTimes(day: Date): { start: string; end: string } {
  const key = dayKey(day);
  return {
    start: `${key}T18:00`,
    end: `${key}T19:00`,
  };
}
