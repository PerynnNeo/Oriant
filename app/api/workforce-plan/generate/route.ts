import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/b/http";
import { generateWorkforcePlan } from "@/lib/server/b/planner";

/** Planner Agent — draft (or return the existing) workforce plan. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { organizationId, force } = body as { organizationId?: string; force?: boolean };
  return handle(async () => {
    const { row, mode } = await generateWorkforcePlan({ organizationId, force });
    return { plan: row, mode };
  });
}
