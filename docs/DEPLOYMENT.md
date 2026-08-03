# Deploying to Vercel

**The build needs no configuration.** `npm run build` runs `scripts/next-prod.mjs`,
which detects a hosted build (`VERCEL` or `CI` in the environment) and uses the
default `.next` output; the `.next-build` split exists only to protect a local
dev server. There is no `vercel.json` and none is needed. Verified by building
with `VERCEL=1` and **zero** env files present: exit 0, 29 static pages,
middleware 33.2 kB. Node is pinned to 20.x in `package.json#engines` to match
what every check in this repo was verified on.

## Which site are you deploying?

`SITE_MODE` decides (lib/site-mode.ts):

| Value | What visitors get |
| --- | --- |
| unset / anything else | **The product.** Landing CTAs navigate into `/app`; every route is reachable. |
| `marketing` | Marketing-only. Every private route 307s to the landing page's demo gate; CTAs open the gate modal. |

The default flipped to the product when the lanes merged. If the old marketing
deployment relied on the *absence* of `SITE_MODE`, that absence now means the
product — set `SITE_MODE=marketing` explicitly if a deployment should stay
locked.

## Environment variables (Vercel → Project → Settings → Environment Variables)

**Product deployment — required for the runtime to work at all:**

| Variable | Value | Why |
| --- | --- | --- |
| `ORIANT_RUNTIME_STORAGE` | `postgres` | THE ONE THAT BITES. The default is the file store under `data/runtime/`, and a Vercel function's filesystem is read-only — the first run/approval write throws. Serverless needs the database. |
| `DATABASE_URL` | Supabase **Transaction pooler** URI (`postgresql://postgres.<ref>:<password>@…pooler.supabase.com:6543/postgres`) | What the postgres store connects to. `lib/runtime/persist/pg/client.ts` validates the shape and names common mistakes. |

**Product deployment — per feature, same values as `.env` locally:**

| Variable(s) | Enables |
| --- | --- |
| `ORIANT_RUNTIME_MODE=live` + `AIAND_API_KEY/BASE_URL/MODEL` | Live reasoning. Unset = deterministic fixture reasoner. |
| `ORIANT_RUNTIME_TOOLS=composio` + `COMPOSIO_API_KEY` | Live tool execution. Unset = stubbed tools (writes simulated, honestly labelled). |
| `ORIANT_ALLOWED_ORGANIZATION_IDS`, `ORIANT_ORGANIZATION_ID` | The execution allowlist, and the fixture plan's stand-in org. See lib/runtime/tools/organization.ts. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | The planner/ingest lane's Supabase access. |
| `ELEVENLABS_API_KEY/VOICE_ID/MODEL_ID`, `NOSANA_*`, `DOUBLEWORD_*`, `DAYTONA_*` | Voice, transcription, generation, sandbox isolation — each optional, each degrades honestly without. |
| `ORIANT_OPERATE_LANE=live` | Defaults the Operate screens to the live lane (also implied by `ORIANT_RUNTIME_MODE=live`). |

**Marketing deployment:** `SITE_MODE=marketing` and nothing else — the
middleware locks everything and `providerEnv()` reports every provider absent
even if keys are present.

## Serverless realities (known, documented, not deploy blockers)

- **Nothing fires schedules by itself.** The poller (`ORIANT_POLLER`) is a
  long-lived process feature; leave it OFF on Vercel. Runs are driven by
  `POST /api/runtime/scheduler`. Note Vercel Cron sends **GET** requests, so
  wiring a cron needs a small GET-accepting entry first — until then, schedules
  fire when something posts.
- **The SSE stream (`/api/runtime/events`) is cut at the function duration
  cap.** By design the client treats each cut as one reconnect + refetch; the
  screens never depend on the stream for correctness.
- **`data/runtime/` state does not exist here.** Everything durable must be in
  Postgres — which is what `ORIANT_RUNTIME_STORAGE=postgres` is for.

## Before sharing the URL

Every `/api/runtime/*` route is **unauthenticated** — declared in each route's
header, acceptable behind a lock or on localhost, not on a public product
deployment. Until auth lands, either enable Vercel Deployment Protection
(password / team SSO) on the product deployment, or keep the public domain on
`SITE_MODE=marketing`. `POST /api/runtime/activation` puts a workforce live;
treat it accordingly.
