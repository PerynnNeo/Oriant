/**
 * lib/server/b/contracts.ts — Zod port of the Role A -> Role B handoff
 * contract (ROLE_A_TO_ROLE_B_HANDOFF_CONTRACT.md / role_a_to_role_b_contract.ts /
 * role_a_to_role_b_handoff.schema.json). This is the authoritative shape of
 * `role_b_handoffs.payload` — validate every row against it before the
 * Planner Agent touches it; never guess field names.
 */
import { z } from "zod";

const zNullable = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().default(null);

/* ── shared enums ── */
const zPeriod = z.enum(["day", "week", "month", "year"]);
const zPriority = z.enum(["low", "medium", "high"]);

/* ── Company ── */
const zHandoffVolume = z.object({
  metric: z.string(),
  value: zNullable(z.number()),
  rangeLabel: zNullable(z.string()),
  period: zNullable(zPeriod),
});

const zCompany = z.object({
  name: z.string(),
  industry: zNullable(z.string()),
  locations: z.array(z.string()),
  businessModel: zNullable(z.string()),
  productsOrServices: z.array(z.string()),
  customerSegments: z.array(z.string()),
  companyStage: zNullable(z.string()),
  approximateBusinessVolume: z.array(zHandoffVolume),
});

const zCurrentAiUsage = z.object({
  level: zNullable(z.enum(["none", "experimental", "occasional", "regular", "advanced"])),
  tools: z.array(z.string()),
  useCases: z.array(z.string()),
  successes: z.array(z.string()),
  concernsOrFailures: z.array(z.string()),
  existingPolicies: z.array(z.string()),
});

/* ── Team ── */
const zDepartment = z.object({
  id: z.string(),
  name: z.string(),
  isPreset: z.boolean(),
  headcount: zNullable(z.number().int().min(0)),
  responsiblePersonOrRole: zNullable(z.string()),
  approvalOwnerPersonOrRole: zNullable(z.string()),
  responsibilities: z.array(z.string()),
  tools: z.array(z.string()),
  painPoints: z.array(z.string()),
  automationIntent: z.enum([
    "yes_explore_automation",
    "no_keep_human_led",
    "evaluate_for_me",
    "unsure",
  ]),
  preferredAiOperatingMode: zNullable(
    z.enum(["assist", "collaborate", "operate_within_rules", "evaluate_for_me"]),
  ),
  restrictions: z.array(z.string()),
});

const zRole = z.object({
  id: z.string(),
  title: z.string(),
  departmentId: zNullable(z.string()),
  headcount: z.number().int().min(0),
  responsibilities: z.array(z.string()),
  overloadedTasks: z.array(z.string()),
  approvalResponsibilities: z.array(z.string()),
});

const zTeam = z.object({
  employeeCount: zNullable(z.number().int().min(0)),
  contractorCount: zNullable(z.number().int().min(0)),
  departments: z.array(zDepartment),
  roles: z.array(zRole),
  capabilityGaps: z.array(z.string()),
});

const zGoal = z.object({
  id: z.string(),
  statement: z.string(),
  priority: zNullable(zPriority),
  desiredOutcome: zNullable(z.string()),
  targetMetric: zNullable(z.string()),
});

/* ── Processes ── */
const zProcessStep = z.object({
  id: z.string(),
  order: z.number().int().min(1),
  description: z.string(),
  performer: zNullable(z.string()),
  tools: z.array(z.string()),
  isDecisionPoint: z.boolean(),
  requiresApproval: z.boolean(),
});

const zCurrentCostEstimate = z.object({
  currency: zNullable(z.string()),
  minimum: zNullable(z.number().min(0)),
  maximum: zNullable(z.number().min(0)),
  period: zNullable(z.enum(["run", "week", "month", "year"])),
  basis: zNullable(z.string()),
});

const zPreliminaryCharacteristics = z.object({
  executionPattern: z.enum(["deterministic", "agentic", "hybrid", "unknown"]),
  rationale: zNullable(z.string()),
  confidence: zNullable(z.number().min(0).max(1)),
  missingInformation: z.array(z.string()),
});

const zOpportunitySignals = z.object({
  frequencyVolume: zNullable(z.number().min(0).max(100)),
  handsOnTimeBurden: zNullable(z.number().min(0).max(100)),
  waitingTimeBurden: zNullable(z.number().min(0).max(100)),
  costBurden: zNullable(z.number().min(0).max(100)),
  errorReworkBurden: zNullable(z.number().min(0).max(100)),
  customerImpact: zNullable(z.number().min(0).max(100)),
  revenueImpact: zNullable(z.number().min(0).max(100)),
  ownerDependency: zNullable(z.number().min(0).max(100)),
  ruleClarity: zNullable(z.number().min(0).max(100)),
  processConsistency: zNullable(z.number().min(0).max(100)),
  dataAvailability: zNullable(z.number().min(0).max(100)),
  integrationReadiness: zNullable(z.number().min(0).max(100)),
  outputVerifiability: zNullable(z.number().min(0).max(100)),
  reversibility: zNullable(z.number().min(0).max(100)),
  risk: zNullable(z.number().min(0).max(100)),
  evidenceConfidence: zNullable(z.number().min(0).max(100)),
});

const zProcess = z.object({
  id: z.string(),
  name: z.string(),
  departmentId: zNullable(z.string()),
  ownerPersonOrRole: zNullable(z.string()),
  peopleOrRolesInvolved: z.array(z.string()),
  description: zNullable(z.string()),
  trigger: zNullable(z.string()),
  cadence: zNullable(z.string()),
  estimatedRunsPerPeriod: zNullable(z.number().min(0)),
  period: zNullable(zPeriod),
  averageHandsOnMinutes: zNullable(z.number().min(0)),
  averageWaitMinutes: zNullable(z.number().min(0)),
  inputs: z.array(z.string()),
  steps: z.array(zProcessStep),
  outputs: z.array(z.string()),
  tools: z.array(z.string()),
  businessRules: z.array(z.string()),
  judgementHeavySteps: z.array(z.string()),
  knownExceptions: z.array(z.string()),
  handoffs: z.array(z.string()),
  approvalRequirements: z.array(z.string()),
  painPoints: z.array(z.string()),
  errorOrReworkPattern: zNullable(z.string()),
  customerImpact: zNullable(z.string()),
  revenueImpactOrOpportunity: zNullable(z.string()),
  currentCostEstimate: zNullable(zCurrentCostEstimate),
  costOfDelay: zNullable(z.string()),
  dataSensitivity: z.enum(["low", "medium", "high", "unknown"]),
  desiredOutcome: zNullable(z.string()),
  evidenceIds: z.array(z.string()),
  preliminaryCharacteristics: zPreliminaryCharacteristics,
  opportunitySignals: zOpportunitySignals,
});

/* ── Automation preferences / systems / lean canvas ── */
const zAutomationPreferences = z.object({
  overallMode: zNullable(
    z.enum([
      "assist",
      "collaborate",
      "operate_within_rules",
      "maximize_eligible_automation",
      "evaluate_for_me",
    ]),
  ),
  discoveryPreference: zNullable(
    z.enum(["i_know_what_to_improve", "evaluate_for_me", "both"]),
  ),
  selectedAreas: z.array(z.string()),
  alwaysRequireApproval: z.array(z.string()),
  prohibitedActions: z.array(z.string()),
  preferredApprovers: z.array(z.string()),
  preferredInitialDeploymentMode: zNullable(
    z.enum(["shadow", "draft", "approval", "limited_automation"]),
  ),
  notificationPreferences: z.array(z.string()),
  initialBudgetRange: zNullable(
    z.object({
      currency: z.string(),
      minimum: zNullable(z.number().min(0)),
      maximum: zNullable(z.number().min(0)),
    }),
  ),
});

const zCurrentSystem = z.object({
  id: z.string(),
  departmentId: zNullable(z.string()),
  category: z.string(),
  name: z.string(),
  connectionStatus: z.enum(["not_requested", "requested", "connected", "unavailable"]),
  intendedUse: zNullable(z.string()),
});

const zLeanCanvas = z.object({
  source: z.enum(["uploaded", "guided", "mixed", "not_provided"]),
  customerSegments: z.array(z.string()),
  problems: z.array(z.string()),
  uniqueValueProposition: zNullable(z.string()),
  solution: z.array(z.string()),
  channels: z.array(z.string()),
  revenueStreams: z.array(z.string()),
  costStructure: z.array(z.string()),
  keyMetrics: z.array(z.string()),
  unfairAdvantage: zNullable(z.string()),
  sourceDocumentIds: z.array(z.string()),
});

const zEvidenceAsset = z.object({
  id: z.string(),
  type: z.enum(["lean_canvas", "document", "audio", "process_video", "screen_recording"]),
  label: z.string(),
  processingStatus: z.enum([
    "uploaded",
    "queued",
    "processing",
    "needs_review",
    "completed",
    "failed",
  ]),
  retentionStatus: z.enum(["temporary", "retained", "deletion_requested", "deleted"]),
  linkedDepartmentIds: z.array(z.string()),
  linkedProcessIds: z.array(z.string()),
});

const zDiscovery = z.object({
  interviewCompleted: z.boolean(),
  interviewMode: z.enum(["voice", "typed", "mixed", "skipped"]),
  summary: zNullable(z.string()),
  confirmedFacts: z.array(z.string()),
  contradictions: z.array(
    z.object({
      fieldPath: z.string(),
      description: z.string(),
      evidenceIds: z.array(z.string()),
      resolution: zNullable(z.string()),
    }),
  ),
  openQuestions: z.array(
    z.object({
      id: z.string(),
      entityType: z.enum(["company", "department", "process"]),
      entityId: zNullable(z.string()),
      question: z.string(),
      importance: zPriority,
    }),
  ),
});

const zEvidence = z.object({
  id: z.string(),
  entityType: z.enum(["company", "department", "process"]),
  entityId: zNullable(z.string()),
  fieldPath: z.string(),
  sourceType: z.enum([
    "onboarding_form",
    "lean_canvas",
    "uploaded_document",
    "voice_interview",
    "text_interview",
    "process_video",
    "screen_recording",
    "employee_input",
    "user_edit",
  ]),
  sourceId: zNullable(z.string()),
  supportingText: zNullable(z.string()),
  startTimeMs: zNullable(z.number().int().min(0)),
  endTimeMs: zNullable(z.number().int().min(0)),
  confidence: zNullable(z.number().min(0).max(1)),
  confirmationStatus: z.enum(["draft", "confirmed", "rejected"]),
});

/* ── Blueprint root ── */
export const BusinessBlueprintSummary = z.object({
  schemaVersion: z.literal("1.1"),
  blueprintId: z.string(),
  organizationId: z.string(),
  onboardingSessionId: z.string(),
  status: z.enum(["draft", "in_review", "approved", "ready_for_role_b"]),
  onboardingExperience: z.object({
    initialChannel: z.enum(["typed", "voice"]),
    currentChannel: z.enum(["typed", "voice"]),
    channelsUsed: z.array(z.enum(["typed", "voice"])),
    evidenceModesUsed: z.array(
      z.enum(["lean_canvas", "document", "process_video", "screen_recording", "employee_input"]),
    ),
    lastProviderConversationId: zNullable(z.string()),
  }),
  company: zCompany,
  currentAiUsage: zCurrentAiUsage,
  team: zTeam,
  goals: z.array(zGoal),
  processes: z.array(zProcess),
  automationPreferences: zAutomationPreferences,
  currentSystems: z.array(zCurrentSystem),
  leanCanvas: zLeanCanvas,
  evidenceAssets: z.array(zEvidenceAsset),
  discovery: zDiscovery,
  evidence: z.array(zEvidence),
  languageAndCommunication: z.object({
    preferredLanguage: z.string(),
    additionalLanguages: z.array(z.string()),
    preferredDiscoveryModes: z.array(
      z.enum(["voice", "typed", "cards", "documents", "process_media"]),
    ),
  }),
  consent: z.object({
    dataProcessingAccepted: z.boolean(),
    microphoneAccepted: z.boolean(),
    audioRecordingAccepted: z.boolean(),
    audioRetentionAccepted: z.boolean(),
    processMediaProcessingAccepted: z.boolean(),
    employeeMediaAuthorizationConfirmed: z.boolean(),
    acceptedAt: zNullable(z.string()),
  }),
  approval: z.object({
    approvedByUserId: zNullable(z.string()),
    approvedAt: zNullable(z.string()),
    approvalVersion: zNullable(z.number().int().min(1)),
  }),
  metadata: z.object({
    version: z.number().int().min(1),
    payloadHash: zNullable(z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: zNullable(z.string()),
  }),
});

export const RoleAHandoffEnvelope = z.object({
  eventType: z.literal("role_a.business_blueprint.approved"),
  eventVersion: z.literal("1.0"),
  handoffId: z.string(),
  idempotencyKey: z.string(),
  occurredAt: z.string(),
  blueprint: BusinessBlueprintSummary,
});

export type BusinessBlueprintSummary = z.infer<typeof BusinessBlueprintSummary>;
export type RoleAHandoffEnvelope = z.infer<typeof RoleAHandoffEnvelope>;
export type ProcessSummary = z.infer<typeof zProcess>;

/**
 * Validate a `role_b_handoffs` row's payload per the contract's acceptance
 * rules (§ "Role B should accept a payload only when..."). Throws with a
 * readable message rather than silently misreading fields.
 */
export function parseHandoffPayload(payload: unknown): RoleAHandoffEnvelope {
  const envelope = RoleAHandoffEnvelope.parse(payload);
  if (envelope.blueprint.status !== "ready_for_role_b") {
    throw new Error(
      `Blueprint status is "${envelope.blueprint.status}", expected "ready_for_role_b"`,
    );
  }
  if (!envelope.blueprint.approval.approvedByUserId || !envelope.blueprint.approval.approvedAt) {
    throw new Error("Blueprint is missing approval.approvedByUserId / approvedAt");
  }
  return envelope;
}
