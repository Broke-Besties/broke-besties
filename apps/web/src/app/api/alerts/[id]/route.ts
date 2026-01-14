import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";

// GET /api/alerts/[id] - Get a specific alert
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const alertId = parseInt(id, 10);

    if (isNaN(alertId)) {
      return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
    }

    const alert = await alertService.getAlertById(alertId, user.id);
    return NextResponse.json({ alert });
  } catch (error) {
    console.error("Error fetching alert:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT /api/alerts/[id] - Update an alert
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const alertId = parseInt(id, 10);

    if (isNaN(alertId)) {
      return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
    }

    const { message, deadline, isActive } = await request.json();

    const alert = await alertService.updateAlert(alertId, user.id, {
      message,
      deadline: deadline ? new Date(deadline) : deadline === null ? null : undefined,
      isActive,
    });

    return NextResponse.json({ message: "Alert updated successfully", alert });
  } catch (error) {
    console.error("Error updating alert:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/alerts/[id] - Delete an alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const alertId = parseInt(id, 10);

    if (isNaN(alertId)) {
      return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
    }

    await alertService.deleteAlert(alertId, user.id);
    return NextResponse.json({ message: "Alert deleted successfully" });
  } catch (error) {
    console.error("Error deleting alert:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("lender") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
