/**
 * lib/server/b/types.ts — jsonb payload shapes for the Role B tables. Each
 * extends the mock UI's existing type (lib/mock/types.ts) additively, so the
 * frontend components that already render those types keep working
 * unchanged; the extra fields are what the Executor Agent adds on top.
 */
import type {
  AgentConfig,
  AgentDef,
  AgentWorkflowDef,
  IntegrationDef,
  WorkforcePlanState,
} from "@/lib/mock/types";
import type { TokenUsage } from "./openai";

/**
 * Cost accounting (see lib/server/b/cost.ts for the math). Two different
 * things, kept explicitly separate so the UI never conflates them:
 *
 * - "real setup cost" = actual usage.total_tokens from the real Planner
 *   selection call + each agent's real Executor generation call, at
 *   $4/1M tokens. Measured, not estimated.
 * - "monthly projected cost" = a projection from the blueprint's own
 *   process frequency/volume data (estimatedRunsPerPeriod) at an assumed
 *   tokens-per-run, also priced at $4/1M. This is an estimate, not a
 *   measurement — no agent has actually run yet. Replace with real
 *   telemetry once the deployment layer reports actual run counts.
 */
export interface AgentCostEstimate {
  realSetupTokens: number;
  realSetupCostUsd: number;
  monthlyProjectedTokens: number;
  monthlyProjectedCostUsd: number;
  /** Blueprint process ids that drove this agent's selection — the basis
   *  for the monthly volume projection. */
  coveredProcessIds: string[];
}

export interface PlanCostSummary {
  plannerTokens: number;
  plannerCostUsd: number;
  /** plannerCostUsd + sum of every agent's realSetupCostUsd. */
  totalRealSetupCostUsd: number;
  /** sum of every agent's monthlyProjectedCostUsd. Always a projection. */
  totalMonthlyProjectedCostUsd: number;
  perAgent: Record<string, AgentCostEstimate>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffSeconds: number;
}

export interface TimeoutPolicy {
  seconds: number;
}

export interface ApprovalPolicy {
  channel: "telegram" | "whatsapp" | "dashboard";
  approverRole: string;
  escalation: string;
}

/** workforce_plans.plan */
export interface WorkforcePlanPayload extends WorkforcePlanState {
  sourceBlueprintId: string;
  sourceBlueprintVersion: number;
  sourcePayloadHash: string | null;
  /**
   * Tier-2 custom agent templates generated for this specific business —
   * AGENT_LIBRARY only ships the 4 fixed demo templates, so real custom
   * agents need their AgentDef shipped alongside the plan. The frontend
   * store merges these into AGENT_LIBRARY at runtime (see lib/mock/store.ts)
   * so every existing component that reads AGENT_LIBRARY[agentId] works
   * unchanged.
   */
  customAgentTemplates: Record<string, AgentDef>;
  costSummary: PlanCostSummary;
  /** Real OpenAI calls consumed by the refinement chat (item 10) — resets to
   *  0 on a fresh plan version. Rate-capped by REFINEMENT_MESSAGE_CAP. */
  refinementMessageCount: number;
}

/** agent_configs.config */
export interface AgentConfigPayload extends AgentConfig {
  promptTemplate: string;
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
  /** Real usage from this agent's Executor generation call. null in fixture mode. */
  tokenUsage: TokenUsage | null;
}

/** workflow_definitions.definition */
export interface WorkflowDefinitionPayload extends AgentWorkflowDef {
  dataSchema: { input: string[]; output: string[] };
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
  approvalPolicy: ApprovalPolicy;
  composedBy: "openai" | "fixture" | "zo-computer-stub";
}

/** integration_manifests.config — never includes credentials. */
export type IntegrationManifestConfig = Pick<
  IntegrationDef,
  "purpose" | "neededBy" | "reads" | "actions" | "advanced" | "permissionSummary"
>;
