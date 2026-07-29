import { handle } from "@/lib/server/b/http";
import { supabaseAdmin } from "@/lib/server/b/supabase";

/**
 * Autosave (items 1/3/4): persists the browser's current `plan` object back
 * to `workforce_plans.plan` so local edits (config changes, design-call
 * answers, workflow reordering, NL refinements) survive past the approval
 * boundary instead of being silently discarded. Never touches status/
 * approved_by/approved_at/version — those only change through
 * /approve or the refinement flow (item 10).
 *
 * Refuses to write once the plan is approved — an approved plan is
 * immutable (blueprint.txt: "changes create a new draft version"); the
 * refinement flow creates a new row rather than PATCHing this one.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { plan?: unknown };
  return handle(async () => {
    if (!body.plan || typeof body.plan !== "object" || !Array.isArray((body.plan as { agents?: unknown }).agents)) {
      throw new Error("Request body must include a plan object with an agents array");
    }
    const db = supabaseAdmin();
    const { data: current, error: fetchErr } = await db
      .from("workforce_plans")
      .select("status")
      .eq("id", id)
      .single();
    if (fetchErr || !current) throw new Error(fetchErr?.message ?? "Plan not found");
    if (current.status === "approved") {
      throw new Error("This plan is approved and immutable. Use the refinement flow to create a new draft version.");
    }

    const { data: updated, error } = await db
      .from("workforce_plans")
      .update({ plan: body.plan })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !updated) throw new Error(error?.message ?? "Failed to save plan");
    return { plan: updated };
  });
}
