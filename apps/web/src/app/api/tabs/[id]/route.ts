import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { tabService } from "@/services/tab.service";

const ERROR_STATUS = new Map([
  ["Amount must be positive", 400],
  ["Description cannot be empty", 400],
  ["Person name cannot be empty", 400],
  ["Invalid status value", 400],
  ["You don't have permission to update this tab", 403],
  ["You don't have permission to delete this tab", 403],
  ["Tab not found", 404],
]);

// Tab ids are Postgres INTs; out-of-range values would make Prisma throw.
function parseId(value: string) {
  return /^\d+$/.test(value) && Number(value) <= 2147483647 ? Number(value) : null;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status = ERROR_STATUS.get(message);
  return NextResponse.json(
    { error: status ? message : "Internal server error" },
    { status: status ?? 500 }
  );
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

    const tabId = parseId((await params).id);
    if (tabId === null) {
      return badRequest("Invalid tab ID");
    }

    const body: Record<string, unknown> | null = await request.json().catch(() => null);
    if (!body) {
      return badRequest("Invalid JSON body");
    }
    const { amount, description, personName, status } = body;

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
    return errorResponse(error);
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

    const tabId = parseId((await params).id);
    if (tabId === null) {
      return badRequest("Invalid tab ID");
    }

    await tabService.deleteTab(tabId, user.id);

    return NextResponse.json({ message: "Tab deleted successfully" });
  } catch (error) {
    console.error("Error deleting tab:", error);
    return errorResponse(error);
  }
}
