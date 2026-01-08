import { NextResponse } from "next/server";
import { Resend } from "resend";
import { SlackConfirmEmail } from "@/components/emails/slack-confirm";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  try {
    const { data, error } = await resend.emails.send({
      // CRITICAL FIX 1: You CANNOT use "brokeBesties.com" yet.
      // You must use this exact email for testing until you verify your domain.
      from: "onboarding@resend.dev",

      // CRITICAL FIX 2: You must use the EXACT email you signed up to Resend with.
      // You cannot send to other people yet.
      to: "danielvenistan@gmail.com",

      subject: "Test from BrokeBesties",
      react: SlackConfirmEmail({ validationCode: "ABC-123" }),
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
