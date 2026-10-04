import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { inviteService } from "@/services/invite.service";

const ERROR_STATUS = new Map([
  ["Invite not found", 404],
  ["You can only cancel invites you sent", 403],
]);

// DELETE /api/invites/[id] - Cancel an invite the current user sent
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
    // Invite ids are Postgres INTs; out-of-range values would make Prisma throw.
    if (!/^\d+$/.test(id) || Number(id) > 2147483647) {
      return NextResponse.json({ error: "Invalid invite ID" }, { status: 400 });
    }

    await inviteService.cancelInvite(user.id, Number(id));

    return NextResponse.json({ message: "Invite cancelled" });
  } catch (error) {
    console.error("Cancel invite error:", error);
    const message = error instanceof Error ? error.message : "";
    const status = ERROR_STATUS.get(message);
    return NextResponse.json(
      { error: status ? message : "Internal server error" },
      { status: status ?? 500 }
    );
  }
}
