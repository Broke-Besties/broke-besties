import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";

const ERROR_STATUS = new Map([
  ["You must be a member of the group to view its debts", 403],
]);

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
    return errorResponse(error, ERROR_STATUS);
  }
}
