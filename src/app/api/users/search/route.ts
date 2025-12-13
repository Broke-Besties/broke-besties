import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { userService } from "@/services/user.service";

// GET /api/users/search - Search for users by email
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const user = await userService.searchUserByEmail(email);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error searching for user:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    let status = 500;
    if (message === "Email parameter is required") status = 400;
    if (message === "User not found") status = 404;
    return NextResponse.json({ error: message }, { status });
  }
}
