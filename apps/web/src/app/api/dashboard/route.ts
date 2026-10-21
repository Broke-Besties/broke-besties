import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { getDashboardData } from "@/lib/dashboard-data";

// GET /api/dashboard - Everything the home screen needs in one request
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await getDashboardData(user));
  } catch (error) {
    console.error("Get dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
