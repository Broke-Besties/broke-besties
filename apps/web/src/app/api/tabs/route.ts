import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { tabService } from "@/services/tab.service";

const CREATE_ERROR_STATUS = new Map([
  ["Valid amount is required", 400],
  ["Description is required", 400],
  ["Person name is required", 400],
  ["Invalid status value", 400],
]);

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

// GET /api/tabs - List the current user's tabs (optional ?status=lending|borrowing|paid)
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tabs = await tabService.getUserTabs(user.id, {
      status: searchParams.get("status"),
    });

    return NextResponse.json({ tabs });
  } catch (error) {
    console.error("Error fetching tabs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/tabs - Create a tab for the current user
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Invalid JSON body");
    }
    const { amount, description, personName, status: rawStatus } =
      body as Record<string, unknown>;
    const status = rawStatus ?? "borrowing";

    // Wrong JSON types get the service's own message (checked in the service's
    // order) instead of crashing it with a TypeError or a Prisma error.
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return badRequest("Valid amount is required");
    }
    if (typeof description !== "string") {
      return badRequest("Description is required");
    }
    if (typeof personName !== "string") {
      return badRequest("Person name is required");
    }
    if (status !== "lending" && status !== "borrowing") {
      return badRequest("Invalid status value");
    }

    const tab = await tabService.createTab({
      amount,
      description,
      personName,
      userId: user.id,
      status,
    });

    return NextResponse.json({ tab }, { status: 201 });
  } catch (error) {
    console.error("Error creating tab:", error);
    const message = error instanceof Error ? error.message : "";
    const status = CREATE_ERROR_STATUS.get(message);
    return status
      ? NextResponse.json({ error: message }, { status })
      : NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
