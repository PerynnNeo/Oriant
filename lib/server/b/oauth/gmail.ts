/**
 * lib/server/b/oauth/gmail.ts — stateless Google OAuth adapter (item 6).
 * No DB access here on purpose — lib/server/b/integration-credentials.ts
 * owns storage; this module only knows how to talk to Google's endpoints.
 * Live only once GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI
 * are set — same honest fixture-mode-or-not pattern as the other adapters.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// read-only Gmail scope: enough for agents to read the shared inbox and
// prepare drafts, matching what the mock UI already tells the owner
// ("read the shared ops inbox, prepare reply drafts") -- never send/delete.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];

export function gmailOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

function requireConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Gmail OAuth is not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI)");
  }
  return { clientId, clientSecret, redirectUri };
}

/** `state` should be an opaque, server-verifiable value (e.g. the integration_manifests.id). */
export function buildGmailAuthUrl(state: string): string {
  const { clientId, redirectUri } = requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // required every time to keep receiving a refresh_token
    scope: GMAIL_SCOPES.join(" "),
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresInSeconds: number;
  scopes: string[];
}

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  error?: string;
  error_description?: string;
}

export async function exchangeGmailCode(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json()) as RawTokenResponse;
  if (!res.ok || body.error) {
    throw new Error(`Google token exchange failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    tokenType: body.token_type,
    expiresInSeconds: body.expires_in,
    scopes: body.scope ? body.scope.split(" ") : GMAIL_SCOPES,
  };
}

export async function refreshGmailToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as RawTokenResponse;
  if (!res.ok || body.error) {
    throw new Error(`Google token refresh failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token, // Google usually omits this on refresh
    tokenType: body.token_type,
    expiresInSeconds: body.expires_in,
    scopes: body.scope ? body.scope.split(" ") : GMAIL_SCOPES,
  };
}
