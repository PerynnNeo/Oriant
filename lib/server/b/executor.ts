/**
 * lib/server/b/executor.ts — Executor Agent / Agent Factory
 * (reference/blueprint.txt §15). Turns an *approved* workforce_plans row
 * into agent_configs + workflow_definitions + integration_manifests rows.
 * Re-runnable: clears any rows from a previous run for the same plan first,
 * so re-approving after an edit doesn't leave stale duplicates.
 */
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";
import { parseHandoffPayload } from "./contracts";
import { AGENT_LIBRARY } from "./agent-catalog";
import { openaiJson, type TokenUsage } from "./openai";
import { tokensToUsd } from "./cost";
import { composeWorkflow } from "./zo-computer";
import type {
  AgentConfigPayload,
  IntegrationManifestConfig,
  WorkflowDefinitionPayload,
  WorkforcePlanPayload,
} from "./types";
import type { AgentDef, IntegrationDef, PlanAgent } from "@/lib/mock/types";
import { INTEGRATIONS } from "@/lib/mock/fixtures/integrations";

const RETRY_POLICY = { maxAttempts: 3, backoffSeconds: 30 };
const TIMEOUT_POLICY = { seconds: 120 };

function titleize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export function resolveTemplate(agentId: string, plan: WorkforcePlanPayload): AgentDef | undefined {
  return AGENT_LIBRARY[agentId] ?? plan.customAgentTemplates[agentId];
}

function detectApprovalChannel(notificationPreferences: string[]): "telegram" | "whatsapp" | "dashboard" {
  const text = notificationPreferences.join(" ").toLowerCase();
  if (text.includes("whatsapp")) return "whatsapp";
  if (text.includes("telegram")) return "telegram";
  return "dashboard";
}

/* ── per-agent prompt + per-workflow data schema (one OpenAI call per agent) ── */

interface AgentDraft {
  promptTemplate: string;
  workflows: Array<{
    workflowId: string;
    inputFields: string[];
    outputFields: string[];
  }>;
}

/** Non-default config fields worth grounding the prompt in — skips empty/default noise. */
function relevantConfig(config: PlanAgent["config"]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config.approvalActions.length) out.approvalActions = config.approvalActions;
  if (config.processOwner) out.processOwner = config.processOwner;
  if (config.approvalOwner) out.approvalOwner = config.approvalOwner;
  if (config.quietHours) out.quietHours = config.quietHours;
  if (config.runFrequency) out.runFrequency = config.runFrequency;
  if (config.dataAccess.length) out.dataAccess = config.dataAccess;
  if (config.forbiddenActions.length) out.forbiddenActions = config.forbiddenActions;
  return out;
}

async function draftAgentArtifacts(
  template: AgentDef,
  placed: PlanAgent,
): Promise<{ data: AgentDraft; mode: "live" | "fixture"; usage: TokenUsage | null }> {
  const designNotes = placed.designAnswers
    ? Object.entries(placed.designAnswers)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  const fixture: AgentDraft = {
    promptTemplate:
      `You are ${template.name}. Role: ${template.role}\n` +
      `Permitted actions: ${template.workflows.flatMap((w) => w.steps).join("; ")}\n` +
      `Always requires human approval for: ${template.humanApprovals.join("; ") || "nothing beyond standard review"}\n` +
      (designNotes ? `Business-specific answers from the design call:\n${designNotes}\n` : "") +
      `Never take an action outside the workflows and permissions defined for this agent.`,
    workflows: template.workflows.map((w) => ({
      workflowId: w.id,
      inputFields: [w.trigger.label, ...w.steps.slice(0, 2)],
      outputFields: w.handoff ? [w.handoff] : [`${w.name} result`],
    })),
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["promptTemplate", "workflows"],
    properties: {
      promptTemplate: { type: "string" },
      workflows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["workflowId", "inputFields", "outputFields"],
          properties: {
            workflowId: { type: "string" },
            inputFields: { type: "array", items: { type: "string" } },
            outputFields: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };

  const result = await openaiJson<AgentDraft>({
    operation: "agent_artifact_generation",
    schemaName: "agent_artifacts",
    schema,
    fixture,
    system:
      "You are the Executor Agent (Agent Factory) for an AI-workforce platform. Given one agent's approved role, " +
      "workflows and permissions, write (1) promptTemplate: the model instructions this agent will run under, grounded " +
      "strictly in its existing workflows/permissions/approvals -- never introduce a permission, tool or action not " +
      "already listed; and (2) for each workflow id, the input and output data fields implied by its steps and handoff. " +
      "If designCallAnswers or currentConfig contain business-specific details (a stated refund policy, quiet hours, " +
      "forbidden actions, an approval owner's name, etc.), the promptTemplate must reflect those specifics directly -- " +
      "do not write generic placeholder text when a real answer was given.",
    user: JSON.stringify(
      {
        name: template.name,
        role: template.role,
        workflows: template.workflows.map((w) => ({
          id: w.id,
          name: w.name,
          steps: w.steps,
          handoff: w.handoff,
          humanApprovals: w.humanApprovals,
        })),
        humanApprovals: template.humanApprovals,
        designCallAnswers: placed.designAnswers ?? null,
        currentConfig: relevantConfig(placed.config),
      },
      null,
      2,
    ),
  });

  return { data: result.data, mode: result.mode, usage: result.usage };
}

/* ── integration manifest synthesis ── */

/**
 * integration_manifests.connection_status uses the Blueprint's own
 * CurrentSystemSummary vocabulary (a DB check constraint enforces exactly
 * these four values) -- NOT the frontend's IntegrationStatus vocabulary
 * (connected/required/optional/needs_approval). The frontend store maps
 * between the two on read/write (see lib/mock/store.ts hydrateIntegrations
 * and app/api/integration-manifests/[id]/route.ts).
 */
type DbConnectionStatus = "connected" | "requested" | "not_requested" | "unavailable";

interface ManifestAccumulator {
  systemName: string;
  category: string;
  connectionStatus: DbConnectionStatus;
  config: IntegrationManifestConfig;
}

function integrationDefFor(integrationId: string): IntegrationDef | undefined {
  return INTEGRATIONS[integrationId];
}

async function buildIntegrationManifests(
  plan: WorkforcePlanPayload,
  currentSystems: { name: string; category: string; connectionStatus: string }[],
): Promise<Map<string, ManifestAccumulator>> {
  const bySystemName = new Map(currentSystems.map((s) => [s.name.toLowerCase(), s]));
  const acc = new Map<string, ManifestAccumulator>();

  for (const placed of plan.agents) {
    const template = resolveTemplate(placed.agentId, plan);
    if (!template) continue;
    for (const req of template.integrations) {
      const def = integrationDefFor(req.integrationId);
      const matched = bySystemName.get((def?.name ?? req.integrationId).toLowerCase());
      const existing = acc.get(req.integrationId);
      const neededBy = new Set(existing?.config.neededBy ?? []);
      neededBy.add(placed.agentId);

      acc.set(req.integrationId, {
        systemName: def?.name ?? titleize(req.integrationId.replace(/-/g, " ")),
        category: def?.category ?? matched?.category ?? "other",
        connectionStatus: (matched?.connectionStatus as DbConnectionStatus | undefined) ?? "not_requested",
        config: {
          purpose: def?.purpose ?? req.purpose,
          neededBy: [...neededBy],
          reads: def?.reads ?? [],
          actions: def?.actions ?? [],
          advanced: def?.advanced ?? { protocol: "unknown", server: "unknown", scopes: [] },
          permissionSummary: def?.permissionSummary ?? [req.purpose],
        },
      });
    }
  }
  return acc;
}

/* ── entry point ── */

export interface ExecutePlanResult {
  agentConfigCount: number;
  workflowDefinitionCount: number;
  integrationManifestCount: number;
}

export async function executeWorkforcePlan(workforcePlanId: string): Promise<ExecutePlanResult> {
  const db = supabaseAdmin();

  const { data: planRow, error: planErr } = await db
    .from("workforce_plans")
    .select("*")
    .eq("id", workforcePlanId)
    .single();
  if (planErr || !planRow) throw new Error(`workforce_plans ${workforcePlanId} not found: ${planErr?.message}`);
  const plan = planRow.plan as WorkforcePlanPayload;

  const { data: handoffRow, error: handoffErr } = await db
    .from("role_b_handoffs")
    .select("payload")
    .eq("id", planRow.role_b_handoff_id)
    .single();
  if (handoffErr || !handoffRow) throw new Error(`role_b_handoffs for plan not found: ${handoffErr?.message}`);
  const blueprint = parseHandoffPayload(handoffRow.payload).blueprint;

  // idempotent re-run: clear this plan's previously generated rows first
  await db.from("agent_configs").delete().eq("workforce_plan_id", workforcePlanId);
  await db.from("workflow_definitions").delete().eq("workforce_plan_id", workforcePlanId);
  await db.from("integration_manifests").delete().eq("workforce_plan_id", workforcePlanId);

  const approvalChannel = detectApprovalChannel(blueprint.automationPreferences.notificationPreferences);

  let agentConfigCount = 0;
  let workflowDefinitionCount = 0;

  const realCostByAgent: Record<string, { tokens: number; costUsd: number }> = {};

  for (const placed of plan.agents) {
    const template = resolveTemplate(placed.agentId, plan);
    if (!template) continue;

    const { data: draft, usage } = await draftAgentArtifacts(template, placed);
    const tokens = usage?.totalTokens ?? 0;
    realCostByAgent[placed.agentId] = { tokens, costUsd: tokensToUsd(tokens) };

    const agentConfig: AgentConfigPayload = {
      ...placed.config,
      promptTemplate: draft.promptTemplate,
      retryPolicy: RETRY_POLICY,
      timeoutPolicy: TIMEOUT_POLICY,
      tokenUsage: usage,
    };

    const { error: acErr } = await db.from("agent_configs").insert({
      workforce_plan_id: workforcePlanId,
      agent_key: placed.agentId,
      config: agentConfig,
    });
    if (acErr) throw new Error(`Failed to insert agent_configs for ${placed.agentId}: ${acErr.message}`);
    agentConfigCount++;

    const draftByWorkflowId = new Map(draft.workflows.map((w) => [w.workflowId, w]));

    for (const workflow of template.workflows) {
      const wfDraft = draftByWorkflowId.get(workflow.id);
      const rawDefinition: WorkflowDefinitionPayload = {
        ...workflow,
        dataSchema: {
          input: wfDraft?.inputFields ?? [workflow.trigger.label],
          output: wfDraft?.outputFields ?? [workflow.handoff],
        },
        retryPolicy: RETRY_POLICY,
        timeoutPolicy: TIMEOUT_POLICY,
        approvalPolicy: {
          channel: approvalChannel,
          approverRole: placed.config.approvalOwner || "Owner",
          escalation: workflow.onFailure,
        },
        composedBy: "openai",
      };

      const composed = await composeWorkflow(rawDefinition);

      const { error: wfErr } = await db.from("workflow_definitions").insert({
        workforce_plan_id: workforcePlanId,
        workflow_key: workflow.id,
        definition: composed,
      });
      if (wfErr) throw new Error(`Failed to insert workflow_definitions for ${workflow.id}: ${wfErr.message}`);
      workflowDefinitionCount++;
    }
  }

  const manifests = await buildIntegrationManifests(
    plan,
    blueprint.currentSystems.map((s) => ({
      name: s.name,
      category: s.category,
      connectionStatus: s.connectionStatus,
    })),
  );

  let integrationManifestCount = 0;
  for (const [integrationId, m] of manifests) {
    const { error: imErr } = await db.from("integration_manifests").insert({
      organization_id: planRow.organization_id,
      workforce_plan_id: workforcePlanId,
      system_name: m.systemName,
      category: m.category,
      connection_status: m.connectionStatus,
      config: m.config,
    });
    if (imErr) throw new Error(`Failed to insert integration_manifests for ${integrationId}: ${imErr.message}`);
    integrationManifestCount++;
  }

  // roll the real per-agent generation cost into the plan's cost summary
  // (item 7) — monthly projections were already computed by the Planner and
  // are left untouched here.
  const updatedPerAgent = { ...plan.costSummary.perAgent };
  for (const [agentId, real] of Object.entries(realCostByAgent)) {
    const existing = updatedPerAgent[agentId];
    if (!existing) continue;
    updatedPerAgent[agentId] = { ...existing, realSetupTokens: real.tokens, realSetupCostUsd: real.costUsd };
  }
  const totalRealSetupCostUsd =
    plan.costSummary.plannerCostUsd + Object.values(updatedPerAgent).reduce((s, a) => s + a.realSetupCostUsd, 0);
  const updatedPlan: WorkforcePlanPayload = {
    ...plan,
    costSummary: { ...plan.costSummary, perAgent: updatedPerAgent, totalRealSetupCostUsd },
  };
  const { error: costErr } = await db
    .from("workforce_plans")
    .update({ plan: updatedPlan })
    .eq("id", workforcePlanId);
  if (costErr) throw new Error(`Failed to persist real cost summary: ${costErr.message}`);

  await db.from("audit_logs").insert({
    external_id: `evt_${randomUUID()}`,
    organization_id: planRow.organization_id,
    action: "workforce_plan.executed",
    subject: `workforce_plans:${workforcePlanId}`,
    detail: `${agentConfigCount} agent configs, ${workflowDefinitionCount} workflow definitions, ${integrationManifestCount} integration manifests`,
  });
  await db.from("system_events").insert({
    external_id: `sysevt_${randomUUID()}`,
    organization_id: planRow.organization_id,
    scope: "role_b",
    event: "workforce_plan.executed",
    status: "completed",
    detail: `Executor Agent completed for plan ${workforcePlanId}`,
  });

  return { agentConfigCount, workflowDefinitionCount, integrationManifestCount };
}
