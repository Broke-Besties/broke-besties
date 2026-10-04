import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";

const NOT_A_MEMBER = "You must be a member of the group to view its debts";

// GET /api/groups/[id]/debts - List a group's debts (members only)
export async function GET(
  _request: NextRequest,
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

    const debts = await debtService.getGroupDebts(Number(id), user.id);

    return NextResponse.json({ debts });
  } catch (error) {
    console.error("Get group debts error:", error);
    const forbidden = error instanceof Error && error.message === NOT_A_MEMBER;
    return NextResponse.json(
      { error: forbidden ? NOT_A_MEMBER : "Internal server error" },
      { status: forbidden ? 403 : 500 }
    );
  }
}
