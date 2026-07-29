/**
 * lib/server/b/agent-catalog.ts — the real Tier-1 preset agent catalog used
 * by the Planner Agent. Re-exports the mock UI's AGENT_LIBRARY (already
 * modelled on the preset-agent template structure in reference/blueprint.txt
 * §11.2: role, workflows, integrations, autonomy notes, costs) so the real
 * pipeline and the demo UI can never silently drift apart.
 */
import { AGENT_LIBRARY } from "@/lib/mock/fixtures/agent-library";
import type { AgentDef } from "@/lib/mock/types";

export { AGENT_LIBRARY };
export type { AgentDef };

/** Compact catalog summary handed to the Planner's OpenAI call. */
export interface CatalogEntry {
  agentId: string;
  name: string;
  role: string;
  coveredOutcomes: string[];
  workflowIds: string[];
  workflowNames: string[];
  integrationIds: string[];
  autonomyNote: string;
  setupCost: number;
  monthlyCost: number;
  isCustomTemplate: boolean;
}

/**
 * Tier-1 preset catalog handed to the Planner's OpenAI selection call.
 * Deliberately excludes `source: "custom"` entries (e.g. the demo's
 * "service-recovery" template): those carry hardcoded, business-specific
 * design-call questions and copy that only make sense for the fixed demo
 * narrative. If a custom-source entry were selectable here, a real
 * business's process could get matched to it and inherit that hardcoded
 * interview instead of a freshly-generated one. Any process with no genuine
 * preset match falls through to buildCustomAgentTemplate() in planner.ts,
 * which always synthesizes fresh, business-grounded design questions.
 */
export function catalogSummary(): CatalogEntry[] {
  return Object.values(AGENT_LIBRARY)
    .filter((a) => a.source !== "custom")
    .map((a) => ({
      agentId: a.id,
      name: a.name,
      role: a.role,
      coveredOutcomes: a.coveredOutcomes,
      workflowIds: a.workflows.map((w) => w.id),
      workflowNames: a.workflows.map((w) => w.name),
      integrationIds: a.integrations.map((i) => i.integrationId),
      autonomyNote: a.autonomyNote,
      setupCost: a.setupCost,
      monthlyCost: a.monthlyCost,
      isCustomTemplate: false,
    }));
}

export function getAgentTemplate(agentId: string): AgentDef | undefined {
  return AGENT_LIBRARY[agentId];
}
