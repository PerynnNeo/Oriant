# Production route audit — marketing-only deployment

Audited: 25 Jul 2026, branch `feat/marketing-only-deployment`.
Policy source of truth: `lib/route-policy.ts` (middleware, robots and the
sitemap all derive from it). Deployment switch: `SITE_MODE`
(`lib/site-mode.ts`) — unset/`marketing` locks everything below except the
Public rows; `product` is for local/internal use only.

## Public routes (render in the marketing deployment)

| Route | File | Notes |
| --- | --- | --- |
| `/` | `app/page.tsx` | Full Oriant.ai landing page + demo gate (`?demo=locked&source=<key>` opens the gate; keys are sanitized against a fixed list). |
| `/privacy` | `app/privacy/page.tsx` | Legal holding page, linked from the footer. |
| `/terms` | `app/terms/page.tsx` | Legal holding page, linked from the footer. |
| `/robots.txt` | `app/robots.ts` | Allows `/`, disallows the real private mounts (`/app`, `/api`, `/demo`, `/onboarding`) without enumerating the internal feature taxonomy, links the sitemap. |
| `/sitemap.xml` | `app/sitemap.ts` | Lists only `/`, `/privacy`, `/terms`. |
| 404 fallback | `app/not-found.tsx` | Branded, no private content; normally unreachable because unknown paths redirect to the locked root state. |

## Static assets (served without triggering the gate)

| Prefix | Contents |
| --- | --- |
| `/_next/*` | Framework output (immutable static + image optimizer). |
| `/brand/*` | Logos and favicons (`lockup.png`, `star.png`, `favicon-*.png`). |
| `/previews/*` | Sanitized, pre-blurred product screenshots for the locked gate (fictional BrightPath demo data only). |
| `/video/*`, `/videos/*` | Landing product-walkthrough video (+ legacy fallback location). |
| `/images/*` | Optional poster images. |

## Locked routes (server-side 307 → `/?demo=locked&source=<key>`)

Every path not listed above is locked by `middleware.ts` after
normalization (lowercase, URL-decode, collapsed slashes, trailing slash
stripped). Attempted paths map to a sanitized preview key; the raw URL is
never echoed.

| Attempted prefix | Preview key |
| --- | --- |
| `/app/onboarding`, `/app/discovery`, `/discovery`, `/onboarding`, `/lean-canvas`, `/interview`, `/report` | `discovery` |
| `/app/planner`, `/app/build`, `/planner`, `/workforce`, `/agents`, `/build` | `planner` |
| `/app/integrations`, `/tools`, `/integrations`, `/connections`, `/settings`, `/usage` | `integrations` |
| `/app/workspace`, `/app/sandbox`, `/app/deploy`, `/demo`, `/activation`, `/workspace`, `/calendar`, `/dashboard`, `/approvals`, `/sandbox`, `/deploy` | `operations` |
| anything else (including `/api/*` and unknown paths) | `generic` |

## Private surfaces still present in the repository

The full product mock remains in the tree (branch `backup/full-product-mock`
holds the canonical copy). It is unreachable in marketing mode through four
independent layers:

1. **Edge middleware** (`middleware.ts`) — 307 redirect before any render;
   works with JavaScript disabled, on refresh, and from history/incognito.
2. **Server-component guards** — `app/app/layout.tsx`, `app/demo/layout.tsx`
   and `app/onboarding/page.tsx` are `force-dynamic` and `redirect()` in
   marketing mode, so no mock page can prerender or flash.
3. **State-store guard** — `lib/server/store.ts` throws in marketing mode
   before reading or writing `data/db.json`, disabling every `/api/*`
   handler even if middleware were bypassed.
4. **Provider disable** — `lib/server/providers/env.ts` reports every
   provider (AI&, Nosana, Doubleword, Daytona) as absent in marketing mode,
   so no visitor can trigger provider spend even with keys in the
   environment.

| Surface | Files | Status |
| --- | --- | --- |
| Product mock (16 routes) | `app/app/**` | Locked (layers 1+2). |
| Legacy Margo demo | `app/demo/**`, `components/MargoApp.tsx` | Locked (layers 1+2). |
| Legacy alias | `app/onboarding/page.tsx` | Redirects to locked state (layers 1+2). |
| Product API (16 handlers) | `app/api/**` | Locked (layers 1+3+4). |
| Mock/product libraries | `lib/mock/**`, `lib/server/**`, `components/mock/**`, `components/screens/**` | Not routable; only reachable via the guarded routes above. |

**Known residual risk (stated honestly):** because the mock code still
exists on this branch, its route names appear in the production build
manifest and its JS chunks are built (though never served to a locked
visitor, route HTML is never rendered, and `/app/*` carries
`robots: noindex`). Removing the code entirely (`git rm`, see runbook §6)
is the recommended final hardening step and was intentionally left for the
repository owner to approve.
