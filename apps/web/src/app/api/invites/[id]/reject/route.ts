import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { inviteService } from "@/services/invite.service";

const NOT_YOURS = "You can only reject invites sent to you";
const ERROR_STATUS = new Map([
  ["Invite not found", 404],
  [NOT_YOURS, 403],
]);

// POST /api/invites/[id]/reject - Reject an invite sent to the current user
export async function POST(
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

    // Invites are addressed to an email, so a session without one has none.
    if (!user.email) {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 });
    }

    await inviteService.rejectInvite(user.email, Number(id));

    return NextResponse.json({ message: "Invite rejected" });
  } catch (error) {
    console.error("Reject invite error:", error);
    const message = error instanceof Error ? error.message : "";
    const status = ERROR_STATUS.get(message);
    return NextResponse.json(
      { error: status ? message : "Internal server error" },
      { status: status ?? 500 }
    );
  }
}
