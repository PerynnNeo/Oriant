/**
 * Role B -> Role C handoff contract.
 *
 * Self-contained: does not import from lib/mock/types.ts or
 * lib/server/b/types.ts on purpose, so Role C can copy this file into their
 * own project without pulling in Role B's frontend/demo code. If the source
 * types change, regenerate this file rather than hand-editing it out of sync.
 *
 * Four tables, all scoped by workforce_plans.id — see
 * ROLE_B_TO_ROLE_C_HANDOFF_CONTRACT.md for field semantics and the
 * "which row is current" lookup sequence.
 */

/* ══════════════════════ shared sub-types ══════════════════════ */

export type OperatingMode = "draft_only" | "act_after_approval" | "auto_within_limits";

export type TriggerKind = "event" | "schedule" | "threshold" | "manual" | "dependency" | "approval";

export type AgentStatus =
  | "recommended"
  | "needs_information"
  | "needs_configuration"
  | "ready_to_build"
  | "building"
  | "validated"
  | "active";

export type AgentConfig = {
  operatingMode: OperatingMode;
  triggers: TriggerKind[];
  triggerDetails?: Partial<Record<TriggerKind, string>>;
  channels: string[];
  /** workflowId -> enabled */
  workflowsEnabled: Record<string, boolean>;
  approvalActions: string[];
  processOwner: string;
  approvalOwner: string;
  quietHours: string;
  runFrequency: string;
  dataAccess: string[];
  forbiddenActions: string[];
};

export type AgentDesignAnswers = {
  objective: string;
  trigger: string;
  inputs: string;
  decisions: string;
  permittedActions: string;
  escalation: string;
  systems: string;
  successCriteria: string;
};

export type AgentWorkflowDef = {
  id: string;
  name: string;
  description: string;
  trigger: { kind: TriggerKind; label: string };
  steps: string[];
  handoff: string;
  onFailure: string;
  humanApprovals: string[];
};

export type IntegrationRequirement = {
  integrationId: string;
  purpose: string;
};

export type DiscoveryQuestion = {
  id: string;
  question: string;
  reason: string;
  /** The known-best answer for this business, from blueprint data — not a placeholder. */
  answer: string;
  factIds: string[];
  sections: string[];
};

/** Full agent template — only present inline for Tier-2 (custom) agents; presets reference a fixed library. */
export type AgentDef = {
  id: string;
  name: string;
  source: "preset" | "custom";
  role: string;
  description: string;
  fitScore: number;
  fitReason: string;
  coveredOutcomes: string[];
  workflows: AgentWorkflowDef[];
  integrations: IntegrationRequirement[];
  autonomyNote: string;
  humanApprovals: string[];
  setupCost: number;
  monthlyCost: number;
  defaultConfig: AgentConfig;
  customProposal?: {
    whyCustom: string;
    objective: string;
    trigger: string;
    requiredInputs: string[];
    teamsInvolved: string[];
    decisions: string[];
    allowedActions: string[];
    prohibitedActions: string[];
    approvalPoints: string[];
    missingInformation: string[];
  };
  designQuestions?: DiscoveryQuestion[];
};

export type PlanAgent = {
  agentId: string;
  status: AgentStatus;
  config: AgentConfig;
  designAnswers: AgentDesignAnswers | null;
  designApproved: boolean;
  workflowOrder: string[];
};

/* ══════════════════════ cost accounting (item 7) ══════════════════════ */

export type AgentCostEstimate = {
  /** Real, measured. 0 until the plan has been through the Executor. */
  realSetupTokens: number;
  realSetupCostUsd: number;
  /** A projection from blueprint process volume -- never a measurement. */
  monthlyProjectedTokens: number;
  monthlyProjectedCostUsd: number;
  coveredProcessIds: string[];
};

export type PlanCostSummary = {
  plannerTokens: number;
  plannerCostUsd: number;
  totalRealSetupCostUsd: number;
  totalMonthlyProjectedCostUsd: number;
  perAgent: Record<string, AgentCostEstimate>;
};

/* ══════════════════════ table: workforce_plans ══════════════════════ */

export type WorkforcePlanPayload = {
  version: number;
  status: "draft" | "approved";
  approvedAt: string | null;
  stale: boolean;
  agents: PlanAgent[];
  planRules: string[];
  lastChange: { summary: string; costDelta: { setup: number; monthly: number } } | null;
  sourceBlueprintId: string;
  sourceBlueprintVersion: number;
  sourcePayloadHash: string | null;
  /** Tier-2 templates generated for this business. Preset agent ids are NOT here -- see the doc's "known limitation". */
  customAgentTemplates: Record<string, AgentDef>;
  costSummary: PlanCostSummary;
};

export type WorkforcePlanRow = {
  id: string;
  role_b_handoff_id: string;
  organization_id: string;
  /** Mirrors plan.version -- the jsonb `plan` field is the source of truth if these ever disagree. */
  version: number;
  status: "draft" | "approved";
  plan: WorkforcePlanPayload;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

/* ══════════════════════ table: agent_configs ══════════════════════ */

export type RetryPolicy = { maxAttempts: number; backoffSeconds: number };
export type TimeoutPolicy = { seconds: number };

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AgentConfigPayload = AgentConfig & {
  promptTemplate: string;
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
  /** null if this agent's artifacts were generated in fixture mode (no OPENAI_API_KEY at the time). */
  tokenUsage: TokenUsage | null;
};

export type AgentConfigRow = {
  id: string;
  workforce_plan_id: string;
  /** Same id as WorkforcePlanPayload.agents[].agentId. Stable across re-approvals; row `id` is not. */
  agent_key: string;
  config: AgentConfigPayload;
  created_at: string;
};

/* ══════════════════════ table: workflow_definitions ══════════════════════ */

export type ApprovalPolicy = {
  channel: "telegram" | "whatsapp" | "dashboard";
  approverRole: string;
  /** Human-readable escalation rule -- not a routing address. */
  escalation: string;
};

export type WorkflowDefinitionPayload = AgentWorkflowDef & {
  dataSchema: { input: string[]; output: string[] };
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
  approvalPolicy: ApprovalPolicy;
  composedBy: "openai" | "fixture" | "zo-computer-stub";
};

export type WorkflowDefinitionRow = {
  id: string;
  workforce_plan_id: string;
  /** Same id as AgentWorkflowDef.id. Stable across re-approvals; row `id` is not. */
  workflow_key: string;
  definition: WorkflowDefinitionPayload;
  created_at: string;
};

/* ══════════════════════ table: integration_manifests ══════════════════════ */

/** Blueprint's own vocabulary -- enforced by a DB check constraint. See doc for meanings. */
export type IntegrationConnectionStatus = "connected" | "requested" | "not_requested" | "unavailable";

export type IntegrationManifestConfig = {
  purpose: string;
  /** Agent ids (agent_key values) that need this integration. */
  neededBy: string[];
  reads: string[];
  actions: string[];
  advanced: { protocol: string; server: string; scopes: string[] };
  permissionSummary: string[];
  /** Never present: access_token, refresh_token, or any credential material. */
};

export type IntegrationManifestRow = {
  id: string;
  organization_id: string;
  workforce_plan_id: string;
  system_name: string;
  category: string;
  connection_status: IntegrationConnectionStatus;
  config: IntegrationManifestConfig;
};

/* ══════════════════════ table: integration_credentials (reference only) ══════════════════════ */

/**
 * Do not read this table directly or decrypt its columns yourself. Call
 * getValidAccessToken(integrationManifestId) from
 * lib/server/b/integration-credentials.ts, which returns a valid, decrypted
 * access token server-side and transparently refreshes it if expired.
 * Shape documented here for awareness only.
 */
export type IntegrationCredentialRow = {
  id: string;
  integration_manifest_id: string;
  organization_id: string;
  provider: string; // e.g. "google"
  access_token_encrypted: string; // AES-256-GCM ciphertext, do not use directly
  refresh_token_encrypted: string | null;
  token_type: string | null;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};
