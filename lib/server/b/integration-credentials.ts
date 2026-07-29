/**
 * lib/server/b/integration-credentials.ts — storage + refresh for real OAuth
 * tokens (item 6). Owns all access to the `integration_credentials` table
 * (see supabase/migrations/0001_integration_credentials.sql); tokens are
 * always encrypted (lib/server/b/crypto.ts) before they touch the DB and
 * decrypted only in-memory, server-side, right before use.
 */
import { supabaseAdmin } from "./supabase";
import { encryptToken, decryptToken } from "./crypto";
import { refreshGmailToken, type GoogleTokenResponse } from "./oauth/gmail";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresInSeconds?: number;
  scopes: string[];
}

export async function upsertCredential(opts: {
  integrationManifestId: string;
  organizationId: string;
  provider: string;
  tokens: TokenSet;
}): Promise<void> {
  const row: Record<string, unknown> = {
    integration_manifest_id: opts.integrationManifestId,
    organization_id: opts.organizationId,
    provider: opts.provider,
    access_token_encrypted: encryptToken(opts.tokens.accessToken),
    token_type: opts.tokens.tokenType ?? null,
    scopes: opts.tokens.scopes,
    expires_at: opts.tokens.expiresInSeconds
      ? new Date(Date.now() + opts.tokens.expiresInSeconds * 1000).toISOString()
      : null,
  };
  // Google usually omits refresh_token on a refresh response -- only
  // overwrite the stored one when a new one is actually issued, never null
  // it out just because this particular exchange didn't return one.
  if (opts.tokens.refreshToken) row.refresh_token_encrypted = encryptToken(opts.tokens.refreshToken);

  const { error } = await supabaseAdmin()
    .from("integration_credentials")
    .upsert(row, { onConflict: "integration_manifest_id" });
  if (error) throw new Error(`Failed to store integration credentials: ${error.message}`);
}

export async function hasStoredCredential(integrationManifestId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("integration_credentials")
    .select("id")
    .eq("integration_manifest_id", integrationManifestId)
    .maybeSingle();
  if (error) throw new Error(`Credential lookup failed: ${error.message}`);
  return !!data;
}

/**
 * Returns a valid (non-expired) access token, refreshing transparently if
 * needed. Callers (e.g. Person C's runtime) never see a refresh_token.
 */
export async function getValidAccessToken(integrationManifestId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("integration_credentials")
    .select("*")
    .eq("integration_manifest_id", integrationManifestId)
    .single();
  if (error || !data) throw new Error(`No stored credentials for integration ${integrationManifestId}`);

  const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const expiringSoon = expiresAtMs !== null && expiresAtMs < Date.now() + 60_000; // 60s safety buffer
  if (!expiringSoon) return decryptToken(data.access_token_encrypted);

  if (!data.refresh_token_encrypted) {
    throw new Error(`Access token for integration ${integrationManifestId} expired and no refresh token is stored`);
  }
  if (data.provider !== "google") {
    throw new Error(`No refresh adapter for provider "${data.provider}"`);
  }

  const refreshToken = decryptToken(data.refresh_token_encrypted);
  const refreshed: GoogleTokenResponse = await refreshGmailToken(refreshToken);
  await upsertCredential({
    integrationManifestId,
    organizationId: data.organization_id,
    provider: data.provider,
    tokens: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      tokenType: refreshed.tokenType,
      expiresInSeconds: refreshed.expiresInSeconds,
      scopes: data.scopes ?? refreshed.scopes,
    },
  });
  return refreshed.accessToken;
}
