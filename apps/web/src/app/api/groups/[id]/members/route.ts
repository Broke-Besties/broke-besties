import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { inviteService } from "@/services/invite.service";

const IDS_REQUIRED = "Group ID and friend user ID are required";
const ERROR_STATUS = new Map([
  [IDS_REQUIRED, 400],
  ["You can only add friends directly to a group", 400],
  ["User is already a member of this group", 400],
  ["You are not a member of this group", 403],
  ["User not found", 404],
]);

// POST /api/groups/[id]/members - Add a friend straight into the group (no invite)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Group ids are Postgres INTs; out-of-range values would make Prisma throw.
    if (!/^\d+$/.test(id) || Number(id) > 2147483647) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    const body: Record<string, unknown> | null = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.friendUserId !== "string") {
      return NextResponse.json({ error: IDS_REQUIRED }, { status: 400 });
    }

    const member = await inviteService.createInviteAsFriend(
      user.id,
      Number(id),
      body.friendUserId
    );

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Add group member error:", error);
    const message = error instanceof Error ? error.message : "";
    const status = ERROR_STATUS.get(message);
    return NextResponse.json(
      { error: status ? message : "Internal server error" },
      { status: status ?? 500 }
    );
  }
}
