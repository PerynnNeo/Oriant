/**
 * lib/server/b/planner.ts — Planner Agent (reference/blueprint.txt §10-§13).
 * Converts an approved Business Blueprint into a draft WorkforcePlanState.
 * "AI proposes, code applies": the OpenAI call only selects/scores which
 * preset covers which process and flags gaps; this module deterministically
 * assembles the final plan structure from those selections.
 *
 * Known simplification (documented, not a bug): Tier-1 preset agents reuse
 * the existing demo copy in AGENT_LIBRARY (role/description/workflows) as-is
 * -- only which presets get selected, and the Tier-2 custom agents, are
 * generated per-business. Personalising preset copy per business is a
 * Phase 2 item (would require frontend changes to read overridden fit text).
 */
import { randomUUID } from "crypto";
import { supabaseAdmin, getDefaultOrganizationId } from "./supabase";
import { parseHandoffPayload, type ProcessSummary, type RoleAHandoffEnvelope } from "./contracts";
import { catalogSummary, AGENT_LIBRARY, type CatalogEntry } from "./agent-catalog";
import { openaiJson, type TokenUsage } from "./openai";
import { monthlyProjectedTokens, tokensToUsd } from "./cost";
import type { AgentCostEstimate, PlanCostSummary, WorkforcePlanPayload } from "./types";
import type {
  AgentConfig,
  AgentDef,
  AgentWorkflowDef,
  DiscoveryQuestion,
  IntegrationRequirement,
  OperatingMode,
  PlanAgent,
  TriggerKind,
} from "@/lib/mock/types";

/* ── deterministic pre-scoring (blueprint §10.3 / §11.3) ── */

function avg(nums: (number | null)[]): number {
  const present = nums.filter((n): n is number => n != null);
  if (!present.length) return 0;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

function opportunityScore(p: ProcessSummary): number {
  const s = p.opportunitySignals;
  const burden = avg([
    s.frequencyVolume,
    s.handsOnTimeBurden,
    s.waitingTimeBurden,
    s.costBurden,
    s.errorReworkBurden,
    s.customerImpact,
    s.revenueImpact,
    s.ownerDependency,
  ]);
  return burden - (s.risk ?? 0) * 0.3;
}

function rankProcesses(processes: ProcessSummary[]): ProcessSummary[] {
  return [...processes].sort((a, b) => opportunityScore(b) - opportunityScore(a));
}

/* ── OpenAI selection call ── */

interface Selection {
  processId: string;
  agentId: string; // catalog id, or "" when needsCustomAgent
  fitScore: number;
  fitReason: string;
  needsCustomAgent: boolean;
}

function keywordOverlap(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const wa = words(a);
  const wb = words(b);
  let hits = 0;
  for (const w of wa) if (wb.has(w)) hits++;
  return hits;
}

/** Deterministic fixture-mode selector (no LLM) — same fallback contract as aiandJson. */
function fixtureSelections(processes: ProcessSummary[], catalog: CatalogEntry[]): Selection[] {
  return processes.map((p) => {
    const haystack = `${p.name} ${p.description ?? ""} ${p.painPoints.join(" ")} ${p.tools.join(" ")}`;
    let best: CatalogEntry | null = null;
    let bestScore = 0;
    for (const c of catalog) {
      const score = keywordOverlap(haystack, `${c.role} ${c.coveredOutcomes.join(" ")} ${c.name}`);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best || bestScore === 0) {
      return {
        processId: p.id,
        agentId: "",
        fitScore: 0,
        fitReason: "No preset agent's coverage overlaps this process closely enough.",
        needsCustomAgent: true,
      };
    }
    return {
      processId: p.id,
      agentId: best.agentId,
      fitScore: Math.min(95, 40 + bestScore * 15),
      fitReason: `Matches "${best.name}"'s existing coverage (${best.coveredOutcomes[0] ?? best.role}).`,
      needsCustomAgent: false,
    };
  });
}

async function selectAgentsForProcesses(
  processes: ProcessSummary[],
  catalog: CatalogEntry[],
): Promise<{ selections: Selection[]; mode: "live" | "fixture"; usage: TokenUsage | null }> {
  const fixture = fixtureSelections(processes, catalog);
  const catalogIds = catalog.map((c) => c.agentId);

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["selections"],
    properties: {
      selections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["processId", "agentId", "fitScore", "fitReason", "needsCustomAgent"],
          properties: {
            processId: { type: "string" },
            agentId: { type: "string", enum: [...catalogIds, ""] },
            fitScore: { type: "integer" },
            fitReason: { type: "string" },
            needsCustomAgent: { type: "boolean" },
          },
        },
      },
    },
  };

  const result = await openaiJson<{ selections: Selection[] }>({
    operation: "workforce_planning",
    schemaName: "workforce_selection",
    schema,
    fixture: { selections: fixture },
    system:
      "You are the Planner Agent for an AI-workforce platform (Oriant AI). Given a prioritized list of a " +
      "small business's current processes and a catalog of preset agent templates, decide, for EVERY process, " +
      "which preset agent template best covers it (by id), with a 0-100 fitScore and one plain-language fitReason " +
      "grounded in that specific process. If no preset template's coverage clearly overlaps the process, set " +
      "needsCustomAgent=true and agentId=\"\" instead of forcing a poor match. Do not invent agent ids outside the catalog.",
    user: `Prioritized processes:\n${JSON.stringify(
      processes.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        painPoints: p.painPoints,
        tools: p.tools,
        businessRules: p.businessRules,
        preliminaryCharacteristics: p.preliminaryCharacteristics,
      })),
      null,
      2,
    )}\n\nPreset agent catalog:\n${JSON.stringify(catalog, null, 2)}\n\nReturn one selection per process.`,
  });

  // validate model ids against the real catalog; bad ids fall back to fixture's pick
  const byId = new Map(fixture.map((f) => [f.processId, f]));
  const validated = result.data.selections.map((s) => {
    if (!s.needsCustomAgent && !catalogIds.includes(s.agentId)) {
      return byId.get(s.processId) ?? s;
    }
    return s;
  });
  return { selections: validated, mode: result.mode, usage: result.usage };
}

/* ── Tier-2 custom agent synthesis (deterministic, no LLM needed) ── */

function titleize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function triggerKindFor(p: ProcessSummary): TriggerKind {
  return p.cadence ? "schedule" : "event";
}

function mapOperatingMode(mode: string | null): OperatingMode {
  switch (mode) {
    case "operate_within_rules":
    case "maximize_eligible_automation":
      return "auto_within_limits";
    case "collaborate":
      return "act_after_approval";
    default:
      return "draft_only";
  }
}

function dedupJoin(values: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  for (const v of values) {
    const t = v?.trim();
    if (t) seen.add(t);
  }
  return [...seen].join(", ");
}

/**
 * Builds a real AgentConfig grounded in the blueprint processes that drove
 * an agent's selection -- the fix for the preset-prompt leak: presets used
 * to clone their template's static defaultConfig verbatim (BrightPath demo
 * people/tools), which then flowed straight into the Executor's generated
 * prompt for a completely different business. Custom agents already built
 * their defaultConfig this way (one process each); this generalizes it to
 * accept multiple processes, since a preset can be selected by more than
 * one. `channels` stays empty and `quietHours` stays "" -- no reliable
 * blueprint field maps to either yet.
 */
function buildConfigFromProcesses(
  processes: ProcessSummary[],
  blueprint: RoleAHandoffEnvelope["blueprint"],
): AgentConfig {
  const triggerKinds = [...new Set(processes.map((p) => triggerKindFor(p)))];
  const triggerDetails: Partial<Record<TriggerKind, string>> = {};
  for (const p of processes) {
    const kind = triggerKindFor(p);
    const label = p.trigger ?? p.cadence ?? "";
    if (!label) continue;
    triggerDetails[kind] = triggerDetails[kind] ? `${triggerDetails[kind]}; ${label}` : label;
  }

  const approvalRequirements = [...new Set(processes.flatMap((p) => p.approvalRequirements))];
  const departments = processes
    .map((p) => blueprint.team.departments.find((d) => d.id === p.departmentId) ?? null)
    .filter((d): d is NonNullable<typeof d> => !!d);

  return {
    operatingMode: mapOperatingMode(blueprint.automationPreferences.overallMode),
    triggers: triggerKinds,
    triggerDetails,
    channels: [],
    workflowsEnabled: {}, // caller fills this in from the template's own workflow ids
    approvalActions: approvalRequirements.length > 0 ? approvalRequirements : blueprint.automationPreferences.alwaysRequireApproval,
    processOwner: dedupJoin(processes.map((p) => p.ownerPersonOrRole)),
    approvalOwner:
      dedupJoin(departments.map((d) => d.approvalOwnerPersonOrRole)) ||
      blueprint.automationPreferences.preferredApprovers[0] ||
      "",
    quietHours: "",
    runFrequency: dedupJoin(processes.map((p) => p.cadence)),
    dataAccess: [...new Set(processes.flatMap((p) => p.tools))],
    forbiddenActions: blueprint.automationPreferences.prohibitedActions,
  };
}

function buildCustomAgentTemplate(
  process: ProcessSummary,
  blueprint: RoleAHandoffEnvelope["blueprint"],
): AgentDef {
  const workflowId = `custom-wf-${process.id}`;
  const workflow: AgentWorkflowDef = {
    id: workflowId,
    name: titleize(process.name),
    description: process.description ?? `Handles ${process.name}.`,
    trigger: { kind: triggerKindFor(process), label: process.trigger ?? process.cadence ?? "As needed" },
    steps: process.steps.length ? process.steps.map((s) => s.description) : [process.name],
    handoff: process.handoffs.join("; ") || "Result is shared with the process owner.",
    onFailure:
      process.knownExceptions.length > 0
        ? `Escalates to ${process.ownerPersonOrRole ?? "the process owner"} on: ${process.knownExceptions.join(", ")}.`
        : `Escalates to ${process.ownerPersonOrRole ?? "the process owner"} if it cannot complete the task.`,
    humanApprovals: process.approvalRequirements,
  };

  const integrations: IntegrationRequirement[] = process.tools.map((tool) => ({
    integrationId: slug(tool),
    purpose: `Used by the existing "${process.name}" process.`,
  }));

  const designQuestions: DiscoveryQuestion[] = [
    {
      id: `dq-${process.id}-objective`,
      question: "What should this agent achieve?",
      reason: "The objective sets the line between coordinating the work and deciding it.",
      answer: process.desiredOutcome ?? process.description ?? "Not yet specified.",
      factIds: [],
      sections: ["goals"],
    },
    {
      id: `dq-${process.id}-trigger`,
      question: "When should the agent step in?",
      reason: "A precise trigger keeps the agent scoped to this process.",
      answer: process.trigger ?? process.cadence ?? "Not yet specified.",
      factIds: [],
      sections: ["processes"],
    },
    {
      id: `dq-${process.id}-inputs`,
      question: "What information and systems does it need?",
      reason: "Required inputs define the read permissions the agent is granted.",
      answer: process.inputs.join(", ") || "Not yet specified.",
      factIds: [],
      sections: ["systems"],
    },
    {
      id: `dq-${process.id}-actions`,
      question: "What may it do on its own, and what must it never do?",
      reason: "Permitted and forbidden actions become hard guardrails in the build.",
      answer:
        (process.steps.filter((s) => !s.requiresApproval).map((s) => s.description).join("; ") ||
          "Not yet specified.") +
        `. Never: ${blueprint.automationPreferences.prohibitedActions.join(", ") || "not yet specified"}.`,
      factIds: [],
      sections: ["rules"],
    },
    {
      id: `dq-${process.id}-escalation`,
      question: "When should it hand the case straight to a person?",
      reason: "Escalation rules stop the agent from looping when it is stuck.",
      answer: process.approvalRequirements.join("; ") || "Not yet specified.",
      factIds: [],
      sections: ["rules", "processes"],
    },
  ];

  const defaultConfig: AgentConfig = {
    ...buildConfigFromProcesses([process], blueprint),
    workflowsEnabled: { [workflowId]: true },
  };

  return {
    id: `custom-${process.id}`,
    name: `${titleize(process.name)} Agent`,
    source: "custom",
    role: process.description ?? `Coordinates ${process.name}.`,
    description:
      process.description ??
      `A custom agent for "${process.name}" — no preset template covered this process closely enough.`,
    fitScore: 0,
    fitReason: "No preset agent's coverage overlaps this process closely enough.",
    coveredOutcomes: process.desiredOutcome ? [process.desiredOutcome] : [],
    workflows: [workflow],
    integrations,
    autonomyNote: "Starts in draft-only mode until the owner completes the design cycle.",
    humanApprovals: process.approvalRequirements,
    setupCost: 0,
    monthlyCost: 0,
    defaultConfig,
    customProposal: {
      whyCustom:
        process.preliminaryCharacteristics.rationale ??
        `No preset agent's capabilities line up with "${process.name}".`,
      objective: process.desiredOutcome ?? process.description ?? "",
      trigger: process.trigger ?? process.cadence ?? "",
      requiredInputs: process.inputs,
      teamsInvolved: process.peopleOrRolesInvolved,
      decisions: process.judgementHeavySteps,
      allowedActions: process.steps.filter((s) => !s.requiresApproval).map((s) => s.description),
      prohibitedActions: blueprint.automationPreferences.prohibitedActions,
      approvalPoints: process.approvalRequirements,
      missingInformation: process.preliminaryCharacteristics.missingInformation,
    },
    designQuestions,
  };
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ── handoff lookup ── */

export async function getLatestHandoffRow(organizationId: string) {
  const { data, error } = await supabaseAdmin()
    .from("role_b_handoffs")
    .select("id, payload, blueprint_version, onboarding_sessions!inner(organization_id)")
    .eq("onboarding_sessions.organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`role_b_handoffs lookup failed: ${error.message}`);
  return data as { id: string; payload: unknown; blueprint_version: number } | null;
}

/**
 * Most recent workforce_plans row for a handoff, by creation time -- not by
 * `version` number. A regenerated plan is a fresh row (see
 * generateWorkforcePlan's nextVersionForHandoff), and while version numbers
 * are assigned monotonically per handoff, recency (created_at) is the
 * unambiguous signal for "current" regardless of how many times any one
 * row was individually re-approved.
 */
export async function getExistingPlanForHandoff(roleBHandoffId: string) {
  const { data, error } = await supabaseAdmin()
    .from("workforce_plans")
    .select("*")
    .eq("role_b_handoff_id", roleBHandoffId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`workforce_plans lookup failed: ${error.message}`);
  return data;
}

export async function nextVersionForHandoff(roleBHandoffId: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("workforce_plans")
    .select("version")
    .eq("role_b_handoff_id", roleBHandoffId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`workforce_plans version lookup failed: ${error.message}`);
  return (data?.version ?? 0) + 1;
}

async function logEvent(organizationId: string, action: string, subject: string, detail: string) {
  const db = supabaseAdmin();
  await db.from("audit_logs").insert({
    external_id: `evt_${randomUUID()}`,
    organization_id: organizationId,
    action,
    subject,
    detail,
  });
  await db.from("system_events").insert({
    external_id: `sysevt_${randomUUID()}`,
    organization_id: organizationId,
    scope: "role_b",
    event: action,
    status: "completed",
    detail,
  });
}

/* ── entry point ── */

export interface GeneratePlanResult {
  row: Record<string, unknown>;
  mode: "live" | "fixture" | "cached";
}

export async function generateWorkforcePlan(opts: {
  organizationId?: string;
  force?: boolean;
}): Promise<GeneratePlanResult> {
  const organizationId = opts.organizationId ?? (await getDefaultOrganizationId());

  const handoffRow = await getLatestHandoffRow(organizationId);
  if (!handoffRow) {
    throw new Error(`No role_b_handoffs row found for organization ${organizationId}`);
  }

  if (!opts.force) {
    const existing = await getExistingPlanForHandoff(handoffRow.id);
    if (existing) return { row: existing, mode: "cached" };
  }

  const envelope = parseHandoffPayload(handoffRow.payload);
  const blueprint = envelope.blueprint;

  const ranked = rankProcesses(blueprint.processes);
  const catalog = catalogSummary();
  const { selections, mode, usage: plannerUsage } = await selectAgentsForProcesses(ranked, catalog);

  const byProcessId = new Map(blueprint.processes.map((p) => [p.id, p]));
  const customAgentTemplates: Record<string, AgentDef> = {};
  const selectedPresetIds = new Set<string>();
  // Which blueprint processes drove each agent's selection — the basis for
  // that agent's monthly volume projection (item 7).
  const agentProcessIds = new Map<string, string[]>();

  for (const sel of selections) {
    if (sel.needsCustomAgent || !sel.agentId) {
      const process = byProcessId.get(sel.processId);
      if (!process) continue;
      const template = buildCustomAgentTemplate(process, blueprint);
      customAgentTemplates[template.id] = template;
      agentProcessIds.set(template.id, [process.id]);
      continue;
    }
    selectedPresetIds.add(sel.agentId);
    const existing = agentProcessIds.get(sel.agentId) ?? [];
    existing.push(sel.processId);
    agentProcessIds.set(sel.agentId, existing);
  }

  const agents: PlanAgent[] = [];

  for (const agentId of selectedPresetIds) {
    const template = AGENT_LIBRARY[agentId];
    if (!template) continue;
    const coveredProcesses = (agentProcessIds.get(agentId) ?? [])
      .map((id) => byProcessId.get(id))
      .filter((p): p is ProcessSummary => !!p);
    // Real business data, not the template's static demo config -- fixes the
    // preset-prompt leak (a preset otherwise carries BrightPath's people/
    // tools/hours straight into the Executor's generated prompt).
    const config: AgentConfig = {
      ...buildConfigFromProcesses(coveredProcesses, blueprint),
      workflowsEnabled: Object.fromEntries(template.workflows.map((w) => [w.id, true])),
    };
    agents.push({
      agentId,
      status: "needs_configuration",
      config,
      designAnswers: null,
      designApproved: false,
      workflowOrder: template.workflows.map((w) => w.id),
    });
  }

  for (const template of Object.values(customAgentTemplates)) {
    agents.push({
      agentId: template.id,
      status: "needs_information",
      config: { ...template.defaultConfig },
      designAnswers: null,
      designApproved: false,
      workflowOrder: template.workflows.map((w) => w.id),
    });
  }

  const perAgent: Record<string, AgentCostEstimate> = {};
  for (const agent of agents) {
    const processIds = agentProcessIds.get(agent.agentId) ?? [];
    const processes = processIds.map((id) => byProcessId.get(id)).filter((p): p is typeof blueprint.processes[number] => !!p);
    const monthlyTokens = monthlyProjectedTokens(processes);
    perAgent[agent.agentId] = {
      realSetupTokens: 0, // filled in by the Executor at approval/execution time
      realSetupCostUsd: 0,
      monthlyProjectedTokens: monthlyTokens,
      monthlyProjectedCostUsd: tokensToUsd(monthlyTokens),
      coveredProcessIds: processIds,
    };
  }

  const plannerTokens = plannerUsage?.totalTokens ?? 0;
  const plannerCostUsd = tokensToUsd(plannerTokens);
  const costSummary: PlanCostSummary = {
    plannerTokens,
    plannerCostUsd,
    totalRealSetupCostUsd: plannerCostUsd, // agents' real cost added by the Executor
    totalMonthlyProjectedCostUsd: Object.values(perAgent).reduce((s, a) => s + a.monthlyProjectedCostUsd, 0),
    perAgent,
  };

  const version = await nextVersionForHandoff(handoffRow.id);
  const plan: WorkforcePlanPayload = {
    version,
    status: "draft",
    approvedAt: null,
    stale: false,
    agents,
    planRules: [],
    lastChange: null,
    sourceBlueprintId: blueprint.blueprintId,
    sourceBlueprintVersion: blueprint.metadata.version,
    sourcePayloadHash: blueprint.metadata.payloadHash,
    customAgentTemplates,
    costSummary,
    refinementMessageCount: 0,
  };

  const { data: inserted, error } = await supabaseAdmin()
    .from("workforce_plans")
    .insert({
      role_b_handoff_id: handoffRow.id,
      organization_id: organizationId,
      version,
      status: "draft",
      plan,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to insert workforce_plans: ${error.message}`);

  await logEvent(
    organizationId,
    "workforce_plan.generated",
    `workforce_plans:${inserted.id}`,
    `Generated from blueprint ${blueprint.blueprintId} v${blueprint.metadata.version} (${mode} mode, ${agents.length} agents)`,
  );

  return { row: inserted, mode };
}
