/**
 * lib/server/b/supabase.ts — server-only Supabase client for the Role B
 * (Planner/Executor) pipeline. Never imported from client code ("use client"
 * files) — every DB access goes through app/api/* route handlers, which run
 * server-side only. Uses the service-role secret key, so it must never be
 * bundled to the browser; both env vars are read at call time and are
 * intentionally NOT prefixed NEXT_PUBLIC_.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SECRET_KEY — set them in .env.local",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** The one organization in the demo dataset — no auth/org-picker exists yet. */
export async function getDefaultOrganizationId(): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) {
    throw new Error(`No organization found: ${error?.message ?? "empty table"}`);
  }
  return data.id as string;
}
