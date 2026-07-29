/**
 * lib/server/b/http.ts — tiny shared response helper for the Role B API
 * routes (app/api/workforce-plan/*, app/api/integration-manifests/*, etc.).
 */
import { NextResponse } from "next/server";

export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    console.error("[oriant:role-b]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
