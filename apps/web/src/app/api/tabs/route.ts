import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { tabService } from "@/services/tab.service";

const VALIDATION_ERRORS = [
  "Valid amount is required",
  "Description is required",
  "Person name is required",
  "Invalid status value",
];

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

    const body: Record<string, unknown> | null = await request.json().catch(() => null);
    if (!body) {
      return badRequest("Invalid JSON body");
    }
    const { amount, description, personName } = body;
    const status = body.status ?? "borrowing";

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
    return VALIDATION_ERRORS.includes(message)
      ? badRequest(message)
      : NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
