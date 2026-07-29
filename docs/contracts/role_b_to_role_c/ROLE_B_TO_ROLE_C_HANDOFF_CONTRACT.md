# Role B → Role C Handoff Contract

## Purpose

Role B (Planner Agent + Executor Agent) turns an owner-approved Business Blueprint
(the Role A → Role B handoff) into an **approved AI Workforce Plan** and its
generated technical artifacts. Role C (sandbox testing, deployment, dashboard)
builds and runs against those artifacts.

This is not a single envelope like the A→B handoff — it's **four related
Supabase tables**, all scoped by `workforce_plans.id`:

```
role_b_handoffs (A→B input)
        │
        ▼
workforce_plans  ──┬──▶ agent_configs         (one row per agent in the plan)
 (the Plan itself)  ├──▶ workflow_definitions   (one row per workflow, across all agents)
                    └──▶ integration_manifests  (one row per unique integration the plan needs)
```

Role C should only build against a `workforce_plans` row whose `status = "approved"`.
A `"draft"` row is still under owner review and may change or be discarded.

## Files in this contract pack

- `role_b_to_role_c_contract.ts` — shared TypeScript row/payload types
- `role_b_to_role_c_handoff.schema.json` — JSON Schema for runtime validation
- `role_b_to_role_c_handoff.example.json` — one real example row per table (pulled
  from an actual generated plan — a veterinary clinic's workforce plan — not invented)
- this document — field semantics and integration rules

## Which row is "current" for an organization

Do **not** assume the highest `version` number for an organization is current —
different blueprint handoffs each start their own `workforce_plans.version` at 1
and increment independently (a plan regenerated after a blueprint edit is a new
row, not a version bump on the old one). To find the organization's current plan:

```
1. Find the latest role_b_handoffs row for the organization
   (via onboarding_sessions.organization_id).
2. Find the most recently created workforce_plans row whose
   role_b_handoff_id matches that handoff.
```

This is exactly what `GET /api/workforce-plan/latest` already does — prefer
calling that route over querying the tables directly when possible.

## Table: `workforce_plans`

The plan itself. `plan` (jsonb) is the primary payload — see
`WorkforcePlanPayload` in the contract file. Top-level DB columns
(`status`, `version`, `approved_by`, `approved_at`) mirror fields already
inside `plan` for fast filtering; **the jsonb `plan` field is the source of
truth** if the two ever disagree (they shouldn't, but the column exists for
indexed queries, not as an independent record).

### `plan.agents[]`

One entry per agent in the plan, `source: "preset"` or `"custom"`. `status`
is a readiness state, not a deployment state — Role C should treat every
agent in an **approved** plan as ready to build regardless of `status`
(`status` reflects the owner's configuration/design-call progress during
planning, not whether the Executor has produced its artifacts).

`config` is that agent's `AgentConfig` at approval time — this is the
**pre-artifact** config the Planner assembled. The Executor's own final
config (with the generated prompt, retry/timeout policy, and real token
usage attached) lives in `agent_configs.config`, not here. Use
`agent_configs` for anything execution-relevant; use `plan.agents[].config`
only if you need the plan-level view without a join.

### `plan.customAgentTemplates`

Full `AgentDef` records for every Tier-2 (custom, business-specific) agent
in this plan — role, workflows, integrations, design-call questions and
answers, `customProposal`. Preset agents are **not** included here; their
template is a fixed, shared library entry (see "Known limitation" below).

### `plan.costSummary`

Real and projected cost (item 7 of the Role B build). Two different things —
**do not average or add them together as one number**:

- `plannerTokens` / `plannerCostUsd`: real `usage.total_tokens` from the one
  OpenAI call that selected/scored agents for this plan, at $4 per 1,000,000
  tokens. Always a real measurement.
- `perAgent[agentId].realSetupTokens` / `realSetupCostUsd`: real tokens from
  that agent's Executor generation call (prompt template + workflow data
  schemas). Real measurement, populated once the plan is approved and
  executed — `0` on a draft plan that hasn't gone through the Executor yet.
- `perAgent[agentId].monthlyProjectedTokens` / `monthlyProjectedCostUsd`: a
  **projection**, not a measurement — `blueprint process frequency × an
  assumed 1,500 tokens/run`, at the same $4/1M rate. No agent has actually
  run in production yet, so there's no real monthly figure to report.
  Replace this with real execution telemetry once Role C's deployment layer
  can report actual run counts and token usage per agent per month.
- `totalRealSetupCostUsd` = `plannerCostUsd` + sum of every agent's
  `realSetupCostUsd`.
- `totalMonthlyProjectedCostUsd` = sum of every agent's
  `monthlyProjectedCostUsd` — always label this as a projection in any UI.

### Known limitation: preset agents' static template *prose* still carries demo copy

A **preset** agent's identity (`role`, `workflows`, `humanApprovals`,
`coveredOutcomes`) comes from a small, fixed library (`AGENT_LIBRARY`) built
for a demo narrative. This used to leak two different ways; only one is
fixed as of this handoff:

- **Fixed**: `plan.agents[].config` (and therefore `agent_configs.config`'s
  `processOwner`, `approvalOwner`, `runFrequency`, `dataAccess`,
  `approvalActions`, `triggers`/`triggerDetails`) is now built fresh from
  the real blueprint processes and department data that drove that preset's
  selection — the same construction custom agents already used. Verified
  against a veterinary clinic: `approvalOwner` correctly reads "Clinic
  Director", `dataAccess` correctly lists "Google Calendar" / "WhatsApp
  Business" / "Xero", not the demo's "Sarah Chen" / "HubSpot" / "QuickBooks".
- **Not fixed, by design**: the **static prose** inside a preset's
  `AgentDef.workflows[].steps` / `.handoff` / `.onFailure` (the fixed
  library's own wording) is unchanged and can still name demo-specific
  people or tools inline — e.g. a step description literally reads "...to
  their HubSpot customer record" or "...to Wei Ling Goh in Slack". Because
  the Executor's prompt-generation call includes those steps verbatim as
  context, a preset agent's generated `promptTemplate` can still surface
  those names even though its `config` no longer does (confirmed on the
  same veterinary clinic plan: `admin-operations`'s prompt still mentions
  "HubSpot"; `finance-followup`'s still mentions "Wei Ling Goh" and
  "QuickBooks" — both purely from step text, not from `config`).

This is an accepted scope boundary, not an oversight: rewriting the preset
library's step-level prose per business would mean regenerating presets the
same way custom agents are built, which erodes what makes a preset a fixed,
proven, reusable template in the first place. **Custom** (Tier-2) agents
never have this problem — their template, design questions, and generated
prompt are built entirely from the real business's blueprint data, prose
included.

**Practical implication for Role C**: treat a preset agent's `config`
fields (owner, tools, hours, approvals) as reliably business-specific.
Treat its `promptTemplate` and any workflow step text as possibly
containing template-library wording (occasionally a demo tool/person name)
alongside the real specifics — if you surface `promptTemplate` directly to
an owner, or drive a live agent run from it unreviewed, a light business-
name/tool-name scrub or a human review pass is worth adding on your side
until Role B decides whether to invest in per-business preset prose.

## Table: `agent_configs`

One row per agent, keyed by `(workforce_plan_id, agent_key)`
(`agent_key` = the same id as `plan.agents[].agentId`). `config` is an
`AgentConfigPayload` — the agent's plan-time `AgentConfig` plus:

- `promptTemplate` (string): the model instructions this agent runs under.
  Grounded strictly in that agent's approved workflows/permissions/approvals
  — the Executor is instructed never to introduce a permission, tool, or
  action not already present in the plan (no privilege expansion).
- `retryPolicy` / `timeoutPolicy`: currently fixed defaults
  (`{maxAttempts: 3, backoffSeconds: 30}`, `{seconds: 120}`) for every
  agent — not yet risk-differentiated per agent or workflow.
- `tokenUsage`: real usage from the OpenAI call that generated this row, or
  `null` if it ran in fixture mode (no `OPENAI_API_KEY` configured at the
  time — check this before trusting `promptTemplate` as AI-authored content;
  fixture mode produces a deterministic but simpler template).

This table is cleared and regenerated in full every time a plan is
(re-)approved — do not assume row ids are stable across re-approvals of the
same `workforce_plans.id`. If you need a stable reference, key by
`(workforce_plan_id, agent_key)`, not by row `id`.

## Table: `workflow_definitions`

One row per workflow, keyed by `(workforce_plan_id, workflow_key)`. An
agent can have multiple workflows (`plan.agents[].workflowOrder` lists
them). `definition` is a `WorkflowDefinitionPayload`:

- `dataSchema.input` / `dataSchema.output`: plain-language field names
  implied by the workflow's steps and handoff — a starting point for a real
  input/output schema, not a strict type system yet.
- `approvalPolicy.channel`: `"telegram" | "whatsapp" | "dashboard"`,
  detected from the blueprint's `automationPreferences.notificationPreferences`
  text. **Role B does not send any Telegram/WhatsApp messages** — this
  field only records which channel *should* be used; wiring the actual bot
  integration is Role C's responsibility (confirmed out of Role B's scope).
- `composedBy`: `"openai" | "fixture" | "zo-computer-stub"`. Currently
  always ends as `"zo-computer-stub"` — the Zo Computer workflow-composition
  step is a documented placeholder (no SDK/credentials were available when
  Role B was built) that currently passes the OpenAI-drafted definition
  through unchanged. If Zo Computer becomes available, this value will
  change and the definition's shape may gain fields; treat `composedBy`
  as the signal for which code path produced this row.

Same regeneration caveat as `agent_configs`: cleared and rebuilt on every
approval, key by `(workforce_plan_id, workflow_key)` for stability.

## Table: `integration_manifests`

One row per **unique** integration the plan needs, deduplicated across all
agents (`config.neededBy` lists every agent id that uses it). **Never
contains credentials or tokens** — `config` is metadata only
(`purpose`, `reads`, `actions`, `advanced.{protocol,server,scopes}`,
`permissionSummary`).

Real OAuth tokens (where connected — Gmail is the first live integration)
live in a separate table, `integration_credentials`, encrypted at rest
(AES-256-GCM, app-layer key). **Role C should never need to read that table
directly** — call `getValidAccessToken(integrationManifestId)` from
`lib/server/b/integration-credentials.ts` server-side, which returns a
valid access token and transparently refreshes it if expired. That function
is the only supported way to obtain a usable token; do not decrypt the
table's columns yourself.

### `connection_status`

Uses the Blueprint's own vocabulary — **not** the frontend's
`IntegrationStatus` — enforced by a DB check constraint:

| DB value | Meaning |
|---|---|
| `connected` | A working connection exists (real OAuth token stored, for integrations that support it, or the blueprint reported it as already connected). |
| `requested` | The owner indicated intent to connect but hasn't completed sign-in yet. |
| `not_requested` | Not part of the original blueprint's current systems; may still be required by the plan. |
| `unavailable` | Known to be unreachable/unsupported right now. |

Only Gmail has a real, working `connected` state as of this handoff (item 6
of the Role B build) — every other integration's `connected` status, if you
see one, came from the blueprint's own self-report during onboarding, not
from a verified live connection. Check whether an `integration_credentials`
row exists for a given `integration_manifests.id` before assuming a
non-Gmail integration is actually usable.

## Suggested Role C processing sequence

```text
Poll or watch workforce_plans for status = "approved"
      │
      ▼
Fetch agent_configs + workflow_definitions for that workforce_plan_id
      │
      ▼
Fetch integration_manifests; for each with connection_status = "connected",
call getValidAccessToken() to obtain a usable credential
      │
      ▼
Build/validate in sandbox (your own artifact generation from these rows)
      │
      ▼
Run tests, surface results back for owner review
      │
      ▼
On activation, report real per-agent run counts and token usage back to
Role B so plan.costSummary.perAgent[*].monthlyProjectedCostUsd can be
replaced with a real measurement
```
