import { handle } from "@/lib/server/b/http";
import { applyRefinement, type RefinementDiff } from "@/lib/server/b/refine";

/**
 * Apply a previously-proposed diff. Re-validates against the current plan
 * (it may have changed since /propose). If the plan is approved, this
 * creates a new draft version instead of mutating it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { diff } = (await req.json()) as { diff?: RefinementDiff };
  return handle(async () => {
    if (!diff || !Array.isArray(diff.effects)) throw new Error("diff is required");
    const { row, newVersionCreated } = await applyRefinement(id, diff);
    return { plan: row, newVersionCreated };
  });
}
