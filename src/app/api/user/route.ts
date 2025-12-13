import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { userService } from "@/services/user.service";

// GET /api/user - Get current user info
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await userService.getUserById(user.id);

    return NextResponse.json({ user: userData });
  } catch (error) {
    console.error("Error fetching user:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "User not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
