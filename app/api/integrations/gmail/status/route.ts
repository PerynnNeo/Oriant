import { NextResponse } from "next/server";
import { gmailOAuthConfigured } from "@/lib/server/b/oauth/gmail";

/** Lets the frontend decide: real Google sign-in, or the honest mock wizard. */
export async function GET() {
  return NextResponse.json({ configured: gmailOAuthConfigured() });
}
