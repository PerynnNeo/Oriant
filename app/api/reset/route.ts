import { NextResponse } from "next/server";
import { statePayload } from "@/lib/server/api";
import { loadDb, resetDb } from "@/lib/server/store";
import { assertSupabaseConfigured } from "@/lib/server/supabase";
import { resetDemoDataInSupabase } from "@/lib/server/onboarding-supabase";

export const dynamic = "force-dynamic";

/** Start over from a clean session (demo rehearsal — blueprint §25.2). */
export async function POST() {
  assertSupabaseConfigured();
  const currentDb = await loadDb();
  await resetDemoDataInSupabase(currentDb);
  const db = await resetDb();
  return NextResponse.json(statePayload(db));
}
