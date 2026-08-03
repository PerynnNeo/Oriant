# Oriant

> Turns a conversation about your business into a working AI workforce — and
> stops every agent short of the one thing that matters, so a person decides it.

A small-business owner describes how they operate. Oriant drafts a team of
agents, proves each one in a sandbox, and puts them live against the owner's real
Gmail and Calendar. The point of difference is restraint: **every agent prepares
work and stops, and nothing reaches a customer until a human approves it.**

Built for owners who cannot afford an ops hire and cannot risk an autonomous one.

```bash
npm install
npm run dev        # → http://localhost:3000
npm run verify     # the executable proof — no keys, no network
```

The runtime needs no key, no database and no `.env` to run end to end: a fixture
reasoner, stub tools, a file-backed store and no background poller. Nothing
reaches a real customer. Two caveats worth knowing before you start:

- **The product shell at `/app/*` needs Supabase.** It fetches `/api/state` on
  mount and blocks with a configuration message if that fails. The marketing page
  at `/` and the whole verification suite need nothing.
- **`npm run verify` currently requires Node 22+** and is red on Node 20. See
  [Verification](#verification) — it is a tooling break, not a product defect.

---

## The problem, and why the interesting part isn't the model

Small businesses lose hours a week to work that is repetitive but not safe to
automate blindly — answering the same customer questions, chasing the same
appointments, sending the same campaigns. Tools that promise to automate it
either need a developer, or they act on their own and give the owner no way to
see what they are about to do.

The interesting problem is not *"can a model draft a reply"*. It is:

> **How do you let something act on a real business without the owner losing
> control of it?**

So the product is built around the gates, not the model. The agent is treated as
untrusted throughout.

---

## The four ideas the whole system rests on

### 1. A plan is a contract, not a prompt

`ApprovedPlan` is a validated structure — agents, workflows, ordered step
sequences, tool grants, policy limits, the organization that owns it. Seventeen
validator rules refuse a plan that cannot be enforced, and 21 negative fixtures
prove each rule actually fires.

> **If a limit exists only in prose, it is not a limit.** Prose goes into the
> prompt (what the agent *tries* to do); structure goes into the runtime (what it
> is *allowed* to do). An LLM cannot be trusted to enforce its own constraints,
> so the runtime enforces them outside the model.

The runtime *interprets* the step list rather than executing generated code.
Generated code can never fail to compile, execution order is identical in sandbox
and production, and the model cannot invent a tool call policy did not sanction.

Four step kinds exist: `fetch` (read-only), `reason` (LLM, no side effects),
`act` (side-effecting, gated) and `approve` (an unconditional checkpoint).

### 2. Policy resolves in a fixed order, and fails closed

Every action passes six checks, in this order and no other:

| # | Check | Outcome |
|---|---|---|
| 1 | operation is `forbidden` (agent or org-wide) | **refuse** — never escalated to a human |
| 2 | operation not granted in `tools[].operations` | **refuse** |
| 3 | operation in `alwaysApprove` | **approval** |
| 4 | mode is `draft_only` | **approval** |
| 5 | mode is `act_after_approval` | **approval** |
| 6 | mode is `auto_within_limits` | evaluate limits → act / approve / block |

Two details carry most of the safety. The hard deny is checked **before** the
grant list, so a refund stays refused even if a future plan mistakenly grants it.
And a limit whose metric was never measured counts as **breached, not satisfied** —
absence of evidence is never treated as safety.

Step 6 is a *guarded* branch with an explicit refusal after it. An unrecognised
operating mode cannot fall through into the one path that acts unattended.

### 3. The approval interrupt is real

When an action needs a human, the run **freezes**: the invocation is persisted
with its exact arguments, the run stops at its cursor, and it resumes by replaying
that frozen call after the owner decides. If the owner edits the arguments first,
the merged call is what executes — *what they approved is what runs*.

That is why durable storage matters. A run paused for four hours must outlive the
process it paused in, so the default store writes to disk and Postgres is
available for deployments that need more.

### 4. Nothing goes live on a button

Activation re-derives three gates on **every read** — packages built, sandbox
passed, required integrations connected — and refuses with the specific blocker.

There is no force flag anywhere in the codebase.

---

## The flow, end to end

```
  ┌── Discovery ──────────────────────────────────────────────────────┐
  │  Voice or chat conversation → company report → owner approves     │
  └───────────────────────────────┬───────────────────────────────────┘
                                  │  approved report
  ┌── Plan ──────────────────────▼───────────────────────────────────┐
  │  Drafts the workforce → owner edits → approves → writes a handoff │
  └───────────────────────────────┬───────────────────────────────────┘
                                  │  role_c_handoffs row (Supabase)
  ┌── Build + Operate ───────────▼───────────────────────────────────┐
  │                                                                   │
  │  INGEST     handoff → ApprovedPlan, validated (17 rules)          │
  │     ↓                                                             │
  │  BUILD      one package per agent — prompts, bindings, allowlist  │
  │     ↓       gate: every agent built                               │
  │  SANDBOX    scenarios + stress sweep against stubbed tools        │
  │     ↓       gate: verdict green (deterministic, replayable)       │
  │  ACTIVATE   three gates re-derived → triggers registered → live   │
  │     ↓                                                             │
  │  RUN        scheduler fires → agent works → pauses at the gate    │
  │     ↓                                                             │
  │  APPROVE    owner reviews, edits, decides → run resumes           │
  │     ↓                                                             │
  │  OPERATE    workspace · approvals · calendar · agents · tools     │
  └───────────────────────────────────────────────────────────────────┘
```

`POST /api/runtime/pipeline` runs the whole Build + Operate half in one pass — six
stages, each of which can stop it, each saying why in the owner's language.

---

## Repository map

```
app/
  page.tsx                    marketing landing page
  app/                        the product — 19 routes under one shell
    setup/ onboarding/        guided discovery, voice, Lean Canvas
    discovery/                interview, review, company report      (Gate 1)
    planner/                  workforce plan, per-agent config       (Gate 2)
    integrations/             Composio OAuth connection
    build/ sandbox/ deploy/   factory, proof, activation             (live only)
    pipeline/                 one-pass runner                        (live only)
    workspace/                operate: approvals, calendar, agents, integrations
  api/                        61 route files, 74 handlers
    runtime/*                 the runtime's HTTP surface (14 routes)
    planner/* integrations/*  the plan lane (17 routes)
    onboarding/ discovery/ report/   the discovery lane
  demo/                       legacy Margo prototype, kept intact

lib/
  plan/
    types.ts validate.ts      the ApprovedPlan contract + 17 validator rules
    ingest/                   handoff → ApprovedPlan (with named assumptions)
    fixtures/                 brightpath.ts, meridian.ts — the demo plans
  runtime/
    executor.ts               the step loop and the approval interrupt
    policy.ts                 the six-step resolution order
    factory.ts build/         plan → agent packages, with a build gate
    sandbox/                  scenarios, stress sweep, determinism
      remote/                 Daytona isolation — scenarios run off-machine
    schedule/                 cron, triggers, job queue, worker, activation
    persist/                  durable stores (file + Postgres, 13 tables)
    tools/                    runtime capability → Composio tool, one mapping
    pipeline/                 the one-pass runner and its gates
    verify/                   the executable proof of every milestone

components/
  live/                       screens backed by the real runtime
  mock/                       the scripted demo lane (kept working, permanently)
  landing/                    the marketing page
```

Roughly 135k lines across `app/`, `components/` and `lib/`; about 14k of that is
the verification suite.

---

## Two lanes, and why the choice is never inferred

Several routes have **two screens**: a scripted demo that has carried the product
since before the runtime existed, and a live one backed by the real runtime.

The lane is chosen by something a person typed — never inferred from whether the
runtime happens to hold data:

```bash
?live=1                     # this request, live
?live=0                     # this request, scripted (wins over any default)
ORIANT_APPROVALS_LANE=live  # one surface
ORIANT_OPERATE_LANE=live    # the whole Operate surface
ORIANT_RUNTIME_MODE=live    # the fallback when no lane variable is set
```

Resolution runs in that order, and the last line matters: a **live-armed runtime
defaults its Operate screens to live**, so a deployment with real tools and real
pending approvals does not show scripted fiction to anyone who did not know to
type `?live=1`. A fixture deployment still defaults to the demo.

> Inferring would be wrong twice over: a demo would silently become a live
> decision surface the first time somebody activated a plan, and a live screen
> would silently become a scripted one the moment the runtime went quiet — which
> is precisely when an owner most needs to be told nothing is there.

An unrecognised value (`?live=yes`) is **refused** with a message naming the
setting, the value and the accepted forms — never quietly resolved to the demo,
because the scripted screens are convincing and their controls change nothing.

Four routes have no scripted lane at all and always read the runtime:
`/app/build`, `/app/sandbox`, `/app/deploy`, `/app/pipeline`.

---

## Configuration

Everything below is optional. Unset, the runtime runs fully in fixture mode.

| Variable | What it does |
|---|---|
| `ORIANT_RUNTIME_MODE` | `fixture` (default) or `live` — picks the **reasoner** only |
| `ORIANT_RUNTIME_TOOLS` | unset (stub tools) or `composio` — picks the **tool clients** |
| `ORIANT_RUNTIME_STORAGE` | `file` (default), `memory`, or `postgres`/`supabase` with `DATABASE_URL`. An unrecognised value **throws** — for storage, the dangerous default is "forgets something" |
| `ORIANT_RUNTIME_DATA_DIR` | where the file store lives (default `data/runtime/`) |
| `ORIANT_POLLER` | `on` starts the background scheduler. Default off, so `npm run dev` never silently dispatches a workforce |
| `ORIANT_OPERATE_LANE` | `live` / `demo` — Operate-surface default |
| `ORIANT_ALLOWED_ORGANIZATION_IDS` | the only gate on live tool execution |
| `DATABASE_URL` | Postgres, for the durable stores |
| `AIAND_*` | the reasoner, for `live` mode. Missing keys throw at wiring, not at the first step |
| `COMPOSIO_API_KEY` | real Gmail / Calendar tool execution |
| `DAYTONA_API_KEY` | optional sandbox isolation (`npm run daytona:check`) |

> **The two switches are deliberately independent, and the pairing is a trap.**
> `ORIANT_RUNTIME_MODE=live` alone gives you a real model with **stub hands** —
> nothing leaves the process. Real execution needs `ORIANT_RUNTIME_TOOLS=composio`
> as well. The reverse combination (real tools behind the fixture reasoner) is
> refused loudly at wiring, because the fixture reasoner answers in the runtime's
> own vocabulary and every argument list would fail the tool's schema gate.

See [`docs/RUNTIME_SETUP.md`](docs/RUNTIME_SETUP.md) for which key becomes
necessary when, and [`.env.example`](.env.example) for the annotated list — note
it is currently missing `COMPOSIO_API_KEY` and the `ELEVENLABS_*` set.

**A credential never widens what an agent may do.** Policy is evaluated before
any client is called: a valid token does not let a forbidden operation through,
and it does not let an `alwaysApprove` operation skip approval.

---

## Verification

The runtime is covered by an executable suite rather than assertions in a
document. `scripts/verify.mjs` compiles a slice of the codebase with the repo's
own TypeScript into a temp directory, runs it, and exits non-zero on failure.

```bash
npm run verify          # the whole sweep
npm run verify:m1       # one milestone
npm run verify:pg       # 12 checks executing real SQL (needs DATABASE_URL)
npm run daytona:check   # is remote sandbox isolation available?
```

Two properties make the suite worth trusting. **A tripwire:** each target
declares its expected check count, so a silently deleted check fails the build
rather than quietly reducing coverage. **Determinism:** the passing targets are
byte-identical run to run, including every event timestamp and id — time arrives
through an injected `Clock` and ids through an injected factory, with no `Date.now()`,
`Math.random()` or `randomUUID()` in runtime library code. The sandbox verdict
that Activation gates on cannot be flaky, because a flaky gate is no gate.

### Current status

**`npm run verify` exits 1 on Node 20.** It passes M0–M2 and then dies at M3:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
  node_modules/@composio/core/dist/index.mjs not supported
```

The harness compiles to CommonJS and `@composio/core` is ESM-only;
`lib/runtime/session.ts` statically imports `./tools/composio-sdk`, which imports
the SDK, so any target whose graph reaches the session crashes at module load.
The affected targets **compile cleanly** — this is a loader problem, not a
correctness one.

| Status | Targets | Checks |
|---|---|---|
| ✅ Passing | m0 28 · m1 19 · m2 13 · m4 17 · m5 9 · tools 35 · ingest 9 · e2e 10 · planstate 7 · gmailworkforce 10 · integration 8 | **165** |
| ❌ Blocked | m3 19 · m6 9 · m7 8 · collect 14 | **50** |
| ⏸ Opt-in | pg 12 | — |

Run it on **Node 22+**, where `require(ESM)` is supported. Nothing pins the
version today — there is no `engines` field, no `.nvmrc` and no CI.

### Three findings worth naming, because they show what the tests are for

- A collector bug put the claim marker in `consumed_at` while the writer only
  reset `status`. The first collection of a plan worked and **every revision after
  it was invisible forever** — with the whole suite green, because nothing had
  ever collected the same plan twice. `COLLECT-3` is now that second cycle.
- `GET /api/runtime/agents` hung after one request: issuing more concurrent
  queries than the connection pool holds wedges it permanently against the
  Supabase pooler. Reproduced in isolation, fixed with an in-flight gate, guarded
  by `PG-12`.
- The organization allowlist was enforced per route; an audit found five more
  paths reaching live execution while the gate's own comment claimed full
  coverage. It now lives at the single function that produces a live tool client,
  which covers routes not yet written.

---

## Known limitations

Stated rather than left to be found.

**Security**

- **`/api/runtime/*` is unauthenticated** — and so is every other API group. There
  is no middleware, no session check and no 401 anywhere; all 46 mutating
  handlers are open, including activation and the scheduler.
  `ORIANT_ALLOWED_ORGANIZATION_IDS` gates live tool execution only. This is the
  gap that makes the rest of the safety work theoretical, and the first thing to
  fix.

**What actually crosses the plan seam**

The path from planner to runtime is real — the planner writes a Supabase handoff
row and the runtime reads and claims it — but what arrives is thinner than the
contract allows, and the ingest adapter names every assumption it makes:

- Workflow **steps are synthesised**; the planner ships none.
- **Triggers become `manual`**, so nothing ingested fires on its own.
- **Business outcomes are placeholders**, so the Workspace cannot show real
  progress against them.
- **`operatingMode` is forced to `draft_only`** with no limits, because the
  planner ships no approval boundaries. Safe, but not what the owner chose.
- Tool grants are **tool-level, not operation-level** — coarser than the contract
  intends, and safe only because everything is `draft_only`.

With nothing ingested the runtime serves a demo plan, and every runtime-only
screen carries a full-width "sample workforce" notice.

**Built but not reachable**

- **Daytona isolation** works and was proven remotely, but nothing in the app
  constructs it — it runs from the verification path only.
- **The notifications surface** is complete and imported by no screen.
- **Event and threshold triggers** are written and correct, but nothing delivers
  an event or a metric to them, so agents sweep on a schedule rather than
  reacting.

**Runtime**

- **A real approved send has not been completed end to end.** Everything up to
  the approval is verified against live Gmail; the final send has not been
  exercised.
- **HubSpot and QuickBooks cannot be served** — Composio publishes no invoice,
  payment, refund or note tool for either. Plans needing them are refused by name
  rather than silently degraded.
- **One `act` step is one tool call.** Nothing fans an action out over a list.
- **Outcome metrics show baseline and target only.** Nothing measures a live
  `current` value, so it renders as unmeasured rather than invented.
- `maxRunsPerDay` and resume races are closed **in-process only**; two workers
  over one store can still race, and the code says so where it matters.
- Multi-channel approval delivery (WhatsApp, Telegram, email) is **in-app only**.
  There is no channel toggle, and deliberately no fake one.

**Scripted demo**

- Discovery, onboarding, planner, integrations, setup and the Operate screens
  still default to the scripted lane. Build, Sandbox, Activation and Pipeline are
  live-only; the Operate screens have live implementations behind the lane switch.
- The scripted journey **no longer advances past `plan_review`** — the real plan
  approval writes plan status without advancing the demo state machine.
- The ⌘K command palette and the "Do it for me" autopilot are scripted and reach
  no agent.

---

## Documentation

| Document | What it covers |
|---|---|
| [`docs/SUBMISSION.md`](docs/SUBMISSION.md) | the full write-up and repository review guide |
| [`docs/PLAN_CONTRACT.md`](docs/PLAN_CONTRACT.md) | the ApprovedPlan contract — the seam between planning and execution |
| [`docs/ROLE_C_PLAN.md`](docs/ROLE_C_PLAN.md) | build + operate execution plan, milestone by milestone, with honest status |
| [`docs/RUNTIME_SETUP.md`](docs/RUNTIME_SETUP.md) | which key, what for, and when |
| [`docs/STORAGE.md`](docs/STORAGE.md) | the storage decision and its migration path |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | the scripted walkthrough |

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Zustand ·
Framer Motion · Composio (tool execution) · Supabase / Postgres (durable state) ·
Daytona (sandbox isolation) · esbuild (sandbox runner bundling)

No test framework: `scripts/verify.mjs` compiles the relevant slice with the
repo's own TypeScript and runs it, so the checks work on a clean clone with
nothing installed beyond `npm install`.
