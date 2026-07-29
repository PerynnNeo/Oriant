import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/server/b/supabase";
import { exchangeGmailCode } from "@/lib/server/b/oauth/gmail";
import { upsertCredential } from "@/lib/server/b/integration-credentials";
import { verifyState } from "@/lib/server/b/crypto";

function redirectWithStatus(req: NextRequest, status: "connected" | "error", detail?: string) {
  const url = new URL("/app/integrations", req.url);
  url.searchParams.set("gmail", status);
  if (detail) url.searchParams.set("detail", detail);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const rawState = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) return redirectWithStatus(req, "error", oauthError);
  if (!code || !rawState) return redirectWithStatus(req, "error", "missing_code_or_state");

  const integrationManifestId = verifyState(rawState);
  if (!integrationManifestId) return redirectWithStatus(req, "error", "invalid_state");

  try {
    const db = supabaseAdmin();
    const { data: manifest, error: manifestErr } = await db
      .from("integration_manifests")
      .select("id, organization_id")
      .eq("id", integrationManifestId)
      .single();
    if (manifestErr || !manifest) throw new Error("Unknown integration_manifests id");

    const tokens = await exchangeGmailCode(code);
    await upsertCredential({
      integrationManifestId,
      organizationId: manifest.organization_id,
      provider: "google",
      tokens,
    });

    const { error: updateErr } = await db
      .from("integration_manifests")
      .update({ connection_status: "connected" })
      .eq("id", integrationManifestId);
    if (updateErr) throw new Error(updateErr.message);

    return redirectWithStatus(req, "connected");
  } catch (err) {
    console.error("[oriant] Gmail OAuth callback failed:", err);
    return redirectWithStatus(req, "error", err instanceof Error ? err.message : String(err));
  }
}
