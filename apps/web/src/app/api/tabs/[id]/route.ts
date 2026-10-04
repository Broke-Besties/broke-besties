import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { tabService } from "@/services/tab.service";

const UPDATE_ERROR_STATUS = new Map([
  ["Amount must be positive", 400],
  ["Description cannot be empty", 400],
  ["Person name cannot be empty", 400],
  ["Invalid status value", 400],
  ["You don't have permission to update this tab", 403],
  ["Tab not found", 404],
]);

const DELETE_ERROR_STATUS = new Map([
  ["You don't have permission to delete this tab", 403],
  ["Tab not found", 404],
]);

// Tab ids are Postgres INTs; out-of-range values would make Prisma throw.
function parseId(value: string) {
  const id = Number(value);
  return /^\d+$/.test(value) && id >= 1 && id <= 2147483647 ? id : null;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function errorResponse(error: unknown, statusByMessage: Map<string, number>) {
  const message = error instanceof Error ? error.message : "";
  const status = statusByMessage.get(message);
  return status
    ? NextResponse.json({ error: message }, { status })
    : NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// PATCH /api/tabs/[id] - Update a tab (amount, description, personName, status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tabId = parseId(id);
    if (tabId === null) {
      return badRequest("Invalid tab ID");
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Invalid JSON body");
    }
    const { amount, description, personName, status } =
      body as Record<string, unknown>;

    // Omitted fields stay unchanged; a provided field of the wrong JSON type
    // gets the service's message for that field instead of a TypeError 500.
    if (
      amount !== undefined &&
      (typeof amount !== "number" || !Number.isFinite(amount))
    ) {
      return badRequest("Amount must be positive");
    }
    if (description !== undefined && typeof description !== "string") {
      return badRequest("Description cannot be empty");
    }
    if (personName !== undefined && typeof personName !== "string") {
      return badRequest("Person name cannot be empty");
    }
    if (status !== undefined && typeof status !== "string") {
      return badRequest("Invalid status value");
    }

    const tab = await tabService.updateTab(tabId, user.id, {
      amount,
      description,
      personName,
      status,
    });

    return NextResponse.json({ tab });
  } catch (error) {
    console.error("Error updating tab:", error);
    return errorResponse(error, UPDATE_ERROR_STATUS);
  }
}

// DELETE /api/tabs/[id] - Delete a tab
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tabId = parseId(id);
    if (tabId === null) {
      return badRequest("Invalid tab ID");
    }

    await tabService.deleteTab(tabId, user.id);

    return NextResponse.json({ message: "Tab deleted successfully" });
  } catch (error) {
    console.error("Error deleting tab:", error);
    return errorResponse(error, DELETE_ERROR_STATUS);
  }
}
