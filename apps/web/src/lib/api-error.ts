import { NextResponse } from "next/server";

/** Known service messages pass through with their status; anything else is a generic 500. */
export function errorResponse(error: unknown, statuses: Map<string, number>) {
  const message = error instanceof Error ? error.message : "";
  const status = statuses.get(message);
  return NextResponse.json(
    { error: status ? message : "Internal server error" },
    { status: status ?? 500 }
  );
}
