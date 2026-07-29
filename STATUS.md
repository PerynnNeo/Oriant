# Role B (Planner + Executor) — Status

Last updated: 2026-07-29, end of the session that built the real backend for the
Workforce Plan and Integrations tabs. This file exists so a fresh session (or a
teammate) doesn't have to rediscover any of this by re-exploring the repo.

## TL;DR for a fresh session

- The Workforce Plan and Integrations tabs (`/app/planner`, `/app/integrations`) are
  wired to a real Supabase-backed Planner Agent + Executor Agent pipeline
  (`lib/server/b/*`, `app/api/workforce-plan/*`, `app/api/integration-manifests/*`).
  This is **not** the old `/demo` route's `lib/server/*`/`lib/contracts.ts` — that's a
  separate, untouched legacy surface.
- Everything below is implemented, type-checked (`npx tsc --noEmit`), linted
  (`npx next lint`), and verified against live Supabase + live OpenAI calls — not just
  code review. See each item for exactly how it was verified.
- Two things only the repo owner can finish (I don't have the credentials/access):
  running a SQL migration, and creating a Google OAuth client. Both are under
  "What you still need to do" below — Gmail OAuth is otherwise fully built and will
  start working the moment those two things exist.
- One disclosed, deliberately-not-fixed limitation: preset agents' generated prompts
  can still contain demo tool/people names baked into static template prose (not from
  real business data). Documented in `docs/contracts/role_b_to_role_c/`.

## The 10 original items + the follow-up fix

### 1/3/4 — Agent config, design-call answers, and non-voice config now actually persist

**Was:** every plan edit (config changes, design-call answers, workflow reordering)
only ever touched the browser's local Zustand state. `POST /workforce-plan/[id]/approve`
re-read the *original* Planner-generated plan from the DB, silently discarding
anything the owner had edited. The "Autosaved" label in the top bar was false.

**Now:**
- `PATCH /api/workforce-plan/[id]` (`app/api/workforce-plan/[id]/route.ts`) persists the
  plan; refuses to write once `status = "approved"` (immutability).
- `lib/mock/store.ts` subscribes to any change in `plan` (one subscription catches
  every mutating action by construction, not a per-action patch) and debounce-saves
  (800ms) via that route.
- `approvePlan()` now `await`s a flush of any pending autosave before calling
  `/approve`, so the DB is guaranteed current at approval time.
- The Executor's prompt-generation call (`lib/server/b/executor.ts`,
  `draftAgentArtifacts`) now also receives each agent's `designAnswers` and non-default
  `config` fields, with the system prompt instructed to ground the prompt in them.

**Verified:** live-tested — edited config, waited ~1s, refreshed, edit survived;
approved a plan and inspected `agent_configs.config.promptTemplate`, confirmed it
referenced business-specific answers rather than generic text.

### 2 — Design questions: generated for real custom agents, but one hardcoded leak (fixed)

Custom (Tier-2) agents already generated fresh design questions from blueprint data.
Bug: the Planner's OpenAI selection call could pick the demo's `service-recovery`
template (a `source: "custom"` library entry with hardcoded BrightPath interview
content) as if it were an ordinary preset.

**Fix:** `lib/server/b/agent-catalog.ts`'s `catalogSummary()` now excludes
`source: "custom"` entries from Tier-1 eligibility. Any process with no genuine
preset match always goes through the real custom-agent generator instead.

**Verified:** confirmed via the vet clinic test (item 8) — `service-recovery` was
never selected; the one unmatched process correctly synthesized a fresh,
business-grounded custom agent.

### 5 — Integrations required before Build

Added `hasVisitedIntegrations` (`lib/mock/store.ts`, set the moment
`/app/integrations` mounts) and a swappable `integrationsGateSatisfied()` function in
`lib/mock/state-machine.ts`. Currently checks "visited" — every route gate references
that one function, so switching the bar to "actually connected the required
integrations" later is a one-line change, not a re-plumb.
`components/mock/shell/AppShell.tsx`'s route guard now redirects `/app/build` to
`/app/integrations` if that gate isn't satisfied.

**Verified:** approved a plan without visiting Integrations, clicked "Continue to
build" — landed on Integrations, not Build.

### 6 — Real Gmail OAuth (built, not yet activated — needs you)

Built and type-checked, not yet exercised against a real Google account because it
needs credentials only you can create:

- `supabase/migrations/0001_integration_credentials.sql` — new table storing OAuth
  tokens **encrypted at the application layer** (AES-256-GCM,
  `lib/server/b/crypto.ts`), never in `integration_manifests` (which stays metadata
  -only, as designed).
- `lib/server/b/integration-credentials.ts` — `getValidAccessToken(integrationManifestId)`,
  the only supported way to read a token; transparently refreshes if expired.
- `lib/server/b/oauth/gmail.ts` — stateless Google OAuth adapter (auth URL, code
  exchange, refresh).
- `app/api/integrations/gmail/{connect,callback,status}/route.ts` — the OAuth flow
  itself, with CSRF-protected `state` (signed via `lib/server/b/crypto.ts`'s
  `signState`/`verifyState`).
- `components/mock/integrations/ConnectWizard.tsx` — checks `/gmail/status`; offers
  a real "Continue with Google" button only when configured, otherwise falls back to
  the original honest simulated wizard unchanged.

**Verified so far:** type-check/lint clean; `/gmail/status` correctly reports
`configured: false` right now (no Google credentials set); `/gmail/connect` correctly
400s without a valid `integrationManifestId`. **Not yet verified: an actual live
Google sign-in** — that needs the setup in "What you still need to do" below.

### 7 — Real cost (setup measured, monthly projected — clearly labeled as different things)

**Was:** `lib/mock/pricing.ts`'s `planTotals()` summed a static 4-entry lookup table.
Any real agent not in that table (i.e. every custom agent, and any preset not among
the original 4 demo agents) priced at **$0**.

**Now:**
- `lib/server/b/openai.ts`'s `openaiJson()` captures real `usage.total_tokens` from
  every live OpenAI call.
- `lib/server/b/cost.ts`: `$4 / 1,000,000 tokens`. Two distinct numbers, never
  averaged together:
  - **Setup cost** — real, measured, from the Planner's one selection call plus each
    agent's Executor generation call. `0` until a plan has been approved+executed.
  - **Monthly cost** — a labeled *projection*: blueprint process frequency × an
    assumed 1,500 tokens/run (documented placeholder in `cost.ts`, pending real
    execution telemetry from Person C's deployment layer).
- `plan.costSummary` (new field on `WorkforcePlanPayload`) carries both, per-agent and
  totaled. Frontend: `usePlanTotals()` in `lib/mock/store.ts` returns real numbers
  when `costSummary` is present (`isReal: true`), falling back to the old static
  table only for the pure local demo-fixture flow (fast-forward). `PlannerControls`,
  `GateDrawer`, `PlanInspector` now say "Setup measured · monthly projected" instead
  of "Illustrative pricing" once real data exists.

**Verified:** live-generated a plan — real per-agent token counts and costs matched
what the API actually billed; monthly projections scaled correctly with each
process's real `estimatedRunsPerPeriod` (e.g. a process with 520 runs/month produced
a proportionally larger projection than one with 4 runs/month).

**Known follow-up, not done:** `DeployChecklist.tsx` / `WorkspaceOverview.tsx` already
receive the real numbers (they use the same `usePlanTotals()` hook) but their labels
still say "Illustrative pricing" — cosmetic only, flagged not fixed.

### 8 — Second synthetic business (differentiation test)

Drafted and seeded a **veterinary clinic** ("Riverside Veterinary Clinic") as a brand
new organization, deliberately including one process (walk-in emergency triage) that
shouldn't match any preset. Result, live-verified:
- Appointment scheduling → matched `admin-operations` (Tier 1)
- Invoice follow-up → matched `finance-followup` (Tier 1 — a *different* preset than
  the first test business used)
- Walk-in triage → **no match**, correctly synthesized a fresh custom agent, prompt
  fully grounded in the clinic's real rules ("no AI may suggest a diagnosis," vet
  sign-off required)

This test is what surfaced the preset-config leak (see the follow-up fix below).

### 9 — Role B → Role C handoff contract

`docs/contracts/role_b_to_role_c/`:
- `ROLE_B_TO_ROLE_C_HANDOFF_CONTRACT.md` — field semantics, the real-vs-projected cost
  distinction, `connection_status` vocabulary, `integration_credentials` access rules,
  "which row is current" lookup sequence, and the preset-prose limitation (below).
- `role_b_to_role_c_contract.ts` — self-contained TS types (doesn't import from this
  repo's `lib/`, so Person C can copy it standalone).
- `role_b_to_role_c_handoff.schema.json` — JSON Schema.
- `role_b_to_role_c_handoff.example.json` — one real row per table, pulled from an
  actual generated vet-clinic plan (not invented) and **validated against the
  schema** (all four rows pass).

This is the document Person C should build their dashboard/deployment layer against.

### 10 — Workforce Plan refinement chatbot

`components/mock/planner/RefinementChat.tsx` (replaces the old keyword-fixture
`CommandBar` only when a plan is real — `planId` set; the pure "Interactive Demo"
experience is untouched) + `lib/server/b/refine.ts` +
`app/api/workforce-plan/[id]/refine/{propose,apply}/route.ts`.

- **Scope, deliberately narrow:** remove an existing agent, add a plan-wide rule, add
  an approval requirement to an existing agent. **Never** adds a new agent or grants a
  new integration/permission via chat — that always requires regenerating the plan
  through the Planner. This is the no-privilege-expansion safety rule, enforced
  structurally (the diff schema has no "add agent" effect kind at all, and the
  system prompt explicitly forbids inventing one).
- **Every request produces a reviewable diff** (summary, effects, cost delta, risk
  note) that the owner must explicitly Apply — nothing is auto-applied.
- **Versioning:** if the plan is already `approved` when a diff is applied, applying
  it creates a **new draft `workforce_plans` row** (next version for that
  `role_b_handoff_id`) rather than mutating the approved one. The old approved row and
  its `agent_configs`/`workflow_definitions` are left completely untouched — they just
  stop being "latest" once the new row exists.
- **Rate cap:** `plan.refinementMessageCount`, capped by `REFINEMENT_MESSAGE_CAP`
  (env var, default 30), resets to 0 on a fresh plan version. Counts against the cap
  the moment a real OpenAI call is made (propose), whether or not it's applied.

**Verified live, on the vet clinic's approved plan:**
- Proposed "remove the finance follow-up agent" → got a diff → applied it → confirmed
  a **new** draft row was created with the agent removed, while the original approved
  row was untouched (still `approved`, still had all 3 `agent_configs` rows).
- Proposed "add a new agent that posts to Instagram" → correctly came back as a
  `note` explaining it requires regenerating the plan, **not** a fabricated agent —
  confirms the no-privilege-expansion boundary holds.

### Follow-up fix — preset-agent config no longer carries demo data (prose still does, by design)

Found during item 8 testing: preset agents' generated prompts referenced BrightPath
demo people ("Priya Nair") and tools ("HubSpot") that don't exist at the vet clinic.

**Root cause:** presets cloned their template's static `defaultConfig` verbatim; only
custom agents built `defaultConfig` fresh from real blueprint data.

**Fix:** `lib/server/b/planner.ts`'s `buildConfigFromProcesses()` (shared by both
preset and custom assembly now) builds `processOwner`, `approvalOwner`,
`runFrequency`, `dataAccess`, `approvalActions`, `triggers`/`triggerDetails` from the
real blueprint processes/departments that drove that agent's selection.

**Verified — config-level fix confirmed working:** regenerated the vet clinic plan,
preset `config.approvalOwner` = "Clinic Director" (not "Sarah Chen"),
`config.dataAccess` = real tools (Google Calendar, WhatsApp Business, Xero — not
HubSpot/QuickBooks).

**Disclosed limitation, intentionally not fixed:** the preset library's own static
workflow **step-text prose** (`AgentDef.workflows[].steps`/`.handoff`/`.onFailure`)
still literally names demo tools/people (e.g. a step description says "...to their
HubSpot customer record"), because the Executor's prompt call includes that prose as
context. Confirmed in the regenerated plan: `admin-operations`'s prompt still says
"HubSpot"; `finance-followup`'s still says "Wei Ling Goh" and "QuickBooks" — both
purely from step text, not from `config` anymore. Rewriting preset prose per business
was explicitly decided against — it would blur the distinction between a preset
(fixed, proven, reusable template) and a custom agent (fully regenerated per
business). **Documented in `docs/contracts/role_b_to_role_c/ROLE_B_TO_ROLE_C_HANDOFF_CONTRACT.md`**
under "Known limitation: preset agents' static template *prose* still carries demo copy."

## What you still need to do yourself

I don't have the access to finish these two — everything else in the Gmail OAuth
build is done and waiting on them:

1. **Run the migration**: open the Supabase SQL editor for this project and run
   `supabase/migrations/0001_integration_credentials.sql` in full. Creates the
   `integration_credentials` table (encrypted token storage) — my Supabase
   credentials are a PostgREST service-role REST key, which is DML-only; I can't run
   DDL myself.
2. **Create a Google Cloud OAuth client** (OAuth consent screen + credentials, "Web
   application" type) and add these to `.env.local`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` — must exactly match what you register in the Google
     console, pointing at `/api/integrations/gmail/callback` on wherever this app is
     actually reachable (e.g. `http://localhost:3000/api/integrations/gmail/callback`
     for local dev)
3. **Set an encryption key**: add `INTEGRATION_TOKEN_ENCRYPTION_KEY` to `.env.local`
   — any long random string (it's run through `scrypt` to derive the actual AES key,
   so it doesn't need to be a precisely-sized value). Keep this secret and stable —
   rotating it makes previously-stored tokens undecryptable.

Once all four vars exist and the migration has run, Gmail's "Connect" button in
`/app/integrations` will automatically switch from the simulated wizard to a real
Google sign-in — no code change needed, `ConnectWizard.tsx` already checks for this
at runtime.

Optional, has a sane default if unset: `REFINEMENT_MESSAGE_CAP` (defaults to 30
refinement messages per plan version).

## Environment / setup state (so you don't have to rediscover this)

### `.env.local` — currently set (values not repeated here, this file is not secret-safe)

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`.

**Not yet set** (needed for item 6, see above): `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`.

### Dependencies changed this session

- Added: `zod` (real dependency — used by `lib/server/b/contracts.ts` to validate the
  A→B handoff payload).
- `openai` npm package and `playwright` were both installed temporarily then
  **removed** again — the OpenAI integration uses raw `fetch` (matching the existing
  `lib/server/providers/*` pattern), and Playwright was only used once for a manual
  browser-rendering smoke test, not left as a project dependency.

### Test data seeded in the live Supabase project

Two organizations exist with real, generated, approved plans — useful for manual
testing/demoing without regenerating from scratch:

1. **"Overtone Coffee"** (`organizations.id = 362371c6-f827-4cf4-8492-bac0ce4d2652`) —
   pre-existing org from Person A's own onboarding testing (not created by me). I
   seeded a `role_b_handoffs` row here using a synthetic **"Bloom & Co"** (skincare
   e-commerce) blueprint, since Person A's pipeline hadn't produced a real approved
   blueprint yet at the time. Current approved plan:
   `workforce_plans.id = 5442985e-5505-4fdc-a6f0-4acbeab77e8d` (2 agents: `admin-operations`,
   `marketing`). An earlier test-plan row for this org (`1dd714d3-...`) was deleted
   during the "latest plan" bug fix (see below) — don't be surprised if you don't find
   it.
2. **"Riverside Veterinary Clinic"** (`organizations.id = 02a28881-4f41-4b61-baff-58dc577aa9ce`) —
   created from scratch by me for item 8's differentiation test. Session id
   `2834e5bd-2a13-4014-a1b7-77389b4b05d1`, handoff id
   `70f78868-1362-48c4-bdb4-50f8ea8dc169`. The plan for this org has been
   regenerated/refined multiple times during testing (Tier-2 test, refinement-chatbot
   test, preset-config-fix re-verification) — call `GET /api/workforce-plan/latest?organizationId=02a28881-4f41-4b61-baff-58dc577aa9ce`
   rather than relying on any specific plan id noted earlier in this file; that route
   correctly resolves to whichever version is actually current now.

Both organizations' Supabase rows (`organizations`, `onboarding_sessions`,
`role_b_handoffs`, `workforce_plans`, `agent_configs`, `workflow_definitions`,
`integration_manifests`) are real, live data — not fixtures — and were not cleaned up
at the end of this session on the assumption they're useful for continued
manual testing. Delete them if you'd rather start clean.

### Bug fixed mid-session, worth knowing about

`GET /api/workforce-plan/latest` originally picked the workforce_plans row with the
**highest `version` number** for an organization. This broke once more than one
`role_b_handoffs` lineage existed for the same org (or a plan was regenerated with
`force: true`, which starts a fresh row) — an old, several-times-re-approved plan
could outrank a genuinely newer one. Fixed: `latest` now resolves via the
organization's most recent `role_b_handoffs` row, then the most recently **created**
(not highest-versioned) `workforce_plans` row for that specific handoff — see
`getLatestHandoffRow`/`getExistingPlanForHandoff`/`nextVersionForHandoff` in
`lib/server/b/planner.ts`. Version numbers are now assigned monotonically per
handoff lineage (`nextVersionForHandoff`) rather than reset to 1 on every forced
regeneration.

### Running a local test server without colliding with your own

Throughout this session I ran a second dev server instance for testing, isolated
from whatever you might have running on port 3000:

```
NEXT_DIST_DIR=.next-test PORT=3100 npm run dev
```

The separate `NEXT_DIST_DIR` avoids the two instances fighting over the same
`.next` build directory (a real Windows file-lock issue I hit early on — a plain
second `npm run dev` on a different port alone was not enough). I always deleted
`.next-test/` and reverted Next's auto-edit to `tsconfig.json` (it appends
`.next-test/types/**/*.ts` to `include` when a custom `distDir` is used) after each
test run — none of that should be left behind, but if you ever see either, it's
leftover test-server residue, safe to delete/revert.

### Files touched this session, for orientation

New server code: `lib/server/b/{supabase,contracts,agent-catalog,openai,planner,
executor,zo-computer,http,types,cost,crypto,integration-credentials,refine}.ts`,
`lib/server/b/oauth/gmail.ts`.

New API routes: `app/api/workforce-plan/{generate,latest,[id],[id]/approve,[id]/refine/propose,[id]/refine/apply}/route.ts`,
`app/api/integration-manifests/{route,[id]/route}.ts`, `app/api/agent-configs/route.ts`,
`app/api/workflow-definitions/route.ts`, `app/api/integrations/gmail/{connect,callback,status}/route.ts`.

New frontend: `components/mock/planner/RefinementChat.tsx`.

Modified frontend: `lib/mock/store.ts` (autosave, cost totals, integrations
hydration/visited flag, OAuth wiring hooks), `lib/mock/state-machine.ts` (Integrations
gate), `components/mock/shell/AppShell.tsx`, `components/mock/planner/{PlannerExperience,
PlannerControls,GateDrawer,PlanInspector}.tsx`, `components/mock/integrations/{ConnectWizard,
IntegrationsBody}.tsx`.

New docs/SQL: `docs/contracts/role_b_to_role_c/*`, `supabase/migrations/0001_integration_credentials.sql`.

Not touched, and shouldn't need to be for any of this: the legacy `/demo` route and
its `lib/server/*` (non-`b/`) / `lib/contracts.ts` — a separate, older product surface.
