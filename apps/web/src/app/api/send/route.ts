import { NextResponse } from "next/server";
import { Resend } from "resend";
import { GroupInviteEmail } from "@/components/emails/group-invite";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  try {
    const { data, error } = await resend.emails.send({
      // For testing: use onboarding@resend.dev
      // For production: verify your domain and use something like noreply@yourdomain.com
      from: "onboarding@resend.dev",

      // You can only send to your verified email in testing mode
      to: "danielvenistan@gmail.com",

      subject: "You've been invited to join a group on BrokeBesties",
      react: GroupInviteEmail({
        inviterName: "Test User",
        groupName: "Test Group",
        inviteLink: "https://broke-besties.vercel.app/invites"
      }),
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
