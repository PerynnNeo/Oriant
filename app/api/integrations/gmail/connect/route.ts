import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/server/b/supabase";
import { buildGmailAuthUrl, gmailOAuthConfigured } from "@/lib/server/b/oauth/gmail";
import { signState } from "@/lib/server/b/crypto";

/**
 * Starts a real Gmail OAuth sign-in for one integration_manifests row.
 * Redirects to Google's consent screen; /callback exchanges the code.
 */
export async function GET(req: NextRequest) {
  const integrationManifestId = req.nextUrl.searchParams.get("integrationManifestId");
  if (!integrationManifestId) {
    return NextResponse.json({ error: "integrationManifestId query param is required" }, { status: 400 });
  }
  if (!gmailOAuthConfigured()) {
    return NextResponse.json(
      { error: "Gmail OAuth is not configured on this server yet (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)" },
      { status: 501 },
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("integration_manifests")
    .select("id")
    .eq("id", integrationManifestId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Unknown integration_manifests id" }, { status: 404 });
  }

  const state = signState(integrationManifestId);
  return NextResponse.redirect(buildGmailAuthUrl(state));
}
