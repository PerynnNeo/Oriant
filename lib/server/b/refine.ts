/**
 * lib/server/b/refine.ts — Workforce Plan refinement chat (item 10).
 *
 * Scope, deliberately: this supports REMOVING an agent, ADDING a plan-wide
 * rule, and ADDING an approval requirement to an existing agent — never
 * adding a new agent, granting a new integration, or removing an approval
 * requirement. That's not a technical shortcut; it's the safety boundary
 * requested for this feature ("never grant a permission or integration that
 * wasn't already approved, without going through approval again"). Adding
 * agents/integrations through chat would reopen everything the Planner
 * Agent already does carefully (template resolution, integration
 * deduplication, cost projection) with much weaker guardrails — that stays
 * a Planner-regenerate operation, not a chat edit.
 *
 * "AI proposes, code applies" (same principle as the Planner): the OpenAI
 * call only proposes a diff; nothing changes until the owner explicitly
 * applies it, and applying it is validated against the CURRENT plan again
 * (the plan may have changed between propose and apply).
 */
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";
import { openaiJson } from "./openai";
import { resolveTemplate } from "./executor";
import { nextVersionForHandoff } from "./planner";
import type { WorkforcePlanPayload } from "./types";

const DEFAULT_REFINEMENT_CAP = 30;

export type RefinementEffect =
  | { kind: "add_rule"; rule: string }
  | { kind: "remove_agent"; agentId: string; agentName: string }
  | { kind: "set_approval"; agentId: string; agentName: string; action: string }
  | { kind: "note"; note: string };

export interface RefinementDiff {
  id: string;
  instruction: string;
  summary: string;
  effects: RefinementEffect[];
  costDelta: { setup: number; monthly: number };
  riskNote: string;
  /** True when the plan this diff was proposed against is already approved
   *  -- applying it will create a new draft version, not mutate this one. */
  requiresReapproval: boolean;
}

function refinementCap(): number {
  const raw = Number(process.env.REFINEMENT_MESSAGE_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_REFINEMENT_CAP;
}

async function loadPlanRow(workforcePlanId: string) {
  const { data, error } = await supabaseAdmin()
    .from("workforce_plans")
    .select("*")
    .eq("id", workforcePlanId)
    .single();
  if (error || !data) throw new Error(`workforce_plans ${workforcePlanId} not found: ${error?.message}`);
  return data;
}

function agentDisplayName(agentId: string, plan: WorkforcePlanPayload): string {
  return resolveTemplate(agentId, plan)?.name ?? agentId;
}

/* ── propose ── */

interface RawDiff {
  summary: string;
  effects: RefinementEffect[];
  costDelta: { setup: number; monthly: number };
  riskNote: string;
}

function fixtureDiff(instruction: string, plan: WorkforcePlanPayload): RawDiff {
  const text = instruction.toLowerCase();
  const removeMatch = plan.agents.find((a) => text.includes(agentDisplayName(a.agentId, plan).toLowerCase()));
  if (/remove|drop|delete/.test(text) && removeMatch) {
    return {
      summary: `Remove ${agentDisplayName(removeMatch.agentId, plan)} from the plan.`,
      effects: [{ kind: "remove_agent", agentId: removeMatch.agentId, agentName: agentDisplayName(removeMatch.agentId, plan) }],
      costDelta: { setup: 0, monthly: 0 },
      riskNote: "Removes this agent's workflows entirely; nothing it currently handles will run.",
    };
  }
  if (/approval|approve/.test(text)) {
    const target = plan.agents[0];
    return {
      summary: target ? `Add an approval requirement to ${agentDisplayName(target.agentId, plan)}.` : "Add a plan-wide approval rule.",
      effects: target
        ? [{ kind: "set_approval", agentId: target.agentId, agentName: agentDisplayName(target.agentId, plan), action: instruction.trim() }]
        : [{ kind: "add_rule", rule: instruction.trim() }],
      costDelta: { setup: 0, monthly: 0 },
      riskNote: "Adds a human-approval step; does not change what the agent is allowed to do beyond that.",
    };
  }
  return {
    summary: "Add this as a plan-wide note for the owner to resolve manually.",
    effects: [{ kind: "note", note: instruction.trim() }],
    costDelta: { setup: 0, monthly: 0 },
    riskNote: "This request didn't map to a supported structural change (remove an agent, or add an approval rule).",
  };
}

export async function proposeRefinement(
  workforcePlanId: string,
  instruction: string,
): Promise<{ diff: RefinementDiff; mode: "live" | "fixture" }> {
  if (!instruction.trim()) throw new Error("Instruction is required");

  const planRow = await loadPlanRow(workforcePlanId);
  const plan = planRow.plan as WorkforcePlanPayload;

  const count = plan.refinementMessageCount ?? 0;
  const cap = refinementCap();
  if (count >= cap) {
    throw new Error(`This plan has reached its refinement message limit (${cap}). Approve this plan or generate a new one to continue.`);
  }

  const agentSummaries = plan.agents.map((a) => ({
    agentId: a.agentId,
    name: agentDisplayName(a.agentId, plan),
    approvalActions: a.config.approvalActions,
    workflowOrder: a.workflowOrder,
  }));
  const agentIds = agentSummaries.map((a) => a.agentId);

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "effects", "costDelta", "riskNote"],
    properties: {
      summary: { type: "string" },
      effects: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "rule", "agentId", "agentName", "action", "note"],
          properties: {
            kind: { type: "string", enum: ["add_rule", "remove_agent", "set_approval", "note"] },
            rule: { type: "string" },
            agentId: { type: "string", enum: [...agentIds, ""] },
            agentName: { type: "string" },
            action: { type: "string" },
            note: { type: "string" },
          },
        },
      },
      costDelta: {
        type: "object",
        additionalProperties: false,
        required: ["setup", "monthly"],
        properties: { setup: { type: "number" }, monthly: { type: "number" } },
      },
      riskNote: { type: "string" },
    },
  };

  const fixture = fixtureDiff(instruction, plan);

  const result = await openaiJson<RawDiff>({
    operation: "plan_refinement",
    schemaName: "plan_refinement_diff",
    schema,
    fixture,
    system:
      "You convert an owner's natural-language request into ONE reviewable diff against their AI workforce plan. " +
      "You may ONLY propose these effect kinds: remove_agent (drop an existing agent by its exact agentId), " +
      "set_approval (add a new human-approval requirement to an existing agent's approvalActions -- this can only " +
      "ADD a requirement, never remove one), add_rule (a new plan-wide policy note), or note (anything that doesn't " +
      "map to a supported structural change -- explain in plain language instead of forcing a bad match). " +
      "NEVER invent an agentId outside the current plan's agent list. NEVER propose adding a new agent or a new " +
      "integration -- that is out of scope for this tool; if the request implies one, use kind=note and explain that " +
      "it requires regenerating the plan instead. Unused fields on an effect object should be empty strings.",
    user: JSON.stringify({ currentAgents: agentSummaries, currentPlanRules: plan.planRules, instruction }),
  });

  const validAgentIds = new Set(agentIds);
  const effects = result.data.effects
    .map((e) => (e.kind === "remove_agent" || e.kind === "set_approval" ? { ...e, agentId: e.agentId?.trim() ?? "" } : e))
    .filter((e) => {
      if (e.kind === "remove_agent" || e.kind === "set_approval") return validAgentIds.has(e.agentId);
      return true;
    });

  const diff: RefinementDiff = {
    id: randomUUID(),
    instruction,
    summary: result.data.summary,
    effects,
    costDelta: result.data.costDelta,
    riskNote: result.data.riskNote,
    requiresReapproval: plan.status === "approved",
  };

  // The message counts against the cap the moment a real call is made,
  // whether or not the owner ends up applying it -- this is pure rate-limit
  // metadata, not a change to the approved plan's content, so it's fine to
  // write even when plan.status === "approved" (unlike the autosave PATCH
  // route, which correctly refuses to touch approved plan content).
  const updatedPlan: WorkforcePlanPayload = { ...plan, refinementMessageCount: count + 1 };
  await supabaseAdmin().from("workforce_plans").update({ plan: updatedPlan }).eq("id", workforcePlanId);

  return { diff, mode: result.mode };
}

/* ── apply ── */

export interface ApplyRefinementResult {
  row: Record<string, unknown>;
  newVersionCreated: boolean;
}

export async function applyRefinement(workforcePlanId: string, diff: RefinementDiff): Promise<ApplyRefinementResult> {
  const planRow = await loadPlanRow(workforcePlanId);
  const plan = planRow.plan as WorkforcePlanPayload;

  const validAgentIds = new Set(plan.agents.map((a) => a.agentId));
  for (const e of diff.effects) {
    if ((e.kind === "remove_agent" || e.kind === "set_approval") && !validAgentIds.has(e.agentId)) {
      throw new Error(`Agent "${e.agentId}" no longer exists in this plan — propose the change again.`);
    }
  }

  let agents = plan.agents;
  let planRules = plan.planRules;
  for (const e of diff.effects) {
    if (e.kind === "remove_agent") {
      agents = agents.filter((a) => a.agentId !== e.agentId);
    } else if (e.kind === "add_rule") {
      if (!planRules.includes(e.rule)) planRules = [...planRules, e.rule];
    } else if (e.kind === "set_approval") {
      agents = agents.map((a) =>
        a.agentId === e.agentId && !a.config.approvalActions.includes(e.action)
          ? { ...a, config: { ...a.config, approvalActions: [...a.config.approvalActions, e.action] } }
          : a,
      );
    }
    // "note": no structural change
  }

  const refinedContent = {
    ...plan,
    agents,
    planRules,
    lastChange: { summary: diff.summary, costDelta: diff.costDelta },
  };

  const db = supabaseAdmin();

  if (plan.status === "approved") {
    // Immutable once approved -- a refinement on an approved plan always
    // creates a new draft version; agent_configs/workflow_definitions tied
    // to THIS row are untouched and simply stop being "latest" once the new
    // row exists (see the B->C contract doc's staleness semantics).
    const version = await nextVersionForHandoff(planRow.role_b_handoff_id);
    const newPlan: WorkforcePlanPayload = {
      ...refinedContent,
      version,
      status: "draft",
      approvedAt: null,
      stale: false,
      refinementMessageCount: 0,
    };
    const { data: inserted, error } = await db
      .from("workforce_plans")
      .insert({
        role_b_handoff_id: planRow.role_b_handoff_id,
        organization_id: planRow.organization_id,
        version,
        status: "draft",
        plan: newPlan,
      })
      .select("*")
      .single();
    if (error || !inserted) throw new Error(`Failed to create refined plan version: ${error?.message}`);
    return { row: inserted, newVersionCreated: true };
  }

  const updatedPlan: WorkforcePlanPayload = { ...refinedContent, version: plan.version + 1 };
  const { data: updated, error } = await db
    .from("workforce_plans")
    .update({ version: updatedPlan.version, plan: updatedPlan })
    .eq("id", workforcePlanId)
    .select("*")
    .single();
  if (error || !updated) throw new Error(`Failed to apply refinement: ${error?.message}`);
  return { row: updated, newVersionCreated: false };
}
