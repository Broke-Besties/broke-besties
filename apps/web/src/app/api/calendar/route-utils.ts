import { NextResponse } from "next/server";

export function calendarErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Internal server error";

  if (
    message === "Event not found" ||
    message === "Calendar subscription not found"
  ) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (
    message.includes("not shared with you") ||
    message.includes("owner") ||
    message.includes("hosting") ||
    message.includes("invited with full details") ||
    message.includes("groups you belong to") ||
    message.includes("RSVPs")
  ) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (message === "Internal server error") {
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: message }, { status: 400 });
}

export function parseRange(searchParams: URLSearchParams): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  defaultTo.setDate(defaultTo.getDate() + 7);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const parsedFrom = from ? new Date(from) : defaultFrom;
  const parsedTo = to ? new Date(to) : defaultTo;

  return {
    from: Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom,
    to: Number.isNaN(parsedTo.getTime()) ? defaultTo : parsedTo,
  };
}
