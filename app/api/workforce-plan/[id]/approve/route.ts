import { handle } from "@/lib/server/b/http";
import { supabaseAdmin } from "@/lib/server/b/supabase";
import { executeWorkforcePlan } from "@/lib/server/b/executor";
import type { WorkforcePlanPayload } from "@/lib/server/b/types";

/** Approve the plan (Gate 2), then run the Executor Agent synchronously. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const db = supabaseAdmin();
    const { data: current, error: fetchErr } = await db
      .from("workforce_plans")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !current) throw new Error(fetchErr?.message ?? "Plan not found");

    const approvedAt = new Date().toISOString();
    const previous = current.plan as WorkforcePlanPayload;
    // version bump on approval matches the frontend's existing optimistic-update
    // convention (an approved plan is always "v(draft+1)"); further edits after
    // approval would create their own new draft version.
    const version = previous.version + 1;
    const plan: WorkforcePlanPayload = { ...previous, status: "approved", approvedAt, version };

    const { data: approved, error } = await db
      .from("workforce_plans")
      .update({ status: "approved", approved_by: "owner", approved_at: approvedAt, version, plan })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !approved) throw new Error(error?.message ?? "Failed to approve plan");

    const execution = await executeWorkforcePlan(id);
    return { plan: approved, execution };
  });
}
