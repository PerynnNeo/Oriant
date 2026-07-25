# Marketing deployment runbook — Oriant.ai

How to ship the marketing-only site on branch
`feat/marketing-only-deployment`. The result: only the landing page (plus
`/privacy`, `/terms`, SEO files and static assets) is publicly usable;
every product route opens the guided-demo gate instead.

## 1. Environment

Set these in the host dashboard (see `.env.example`):

| Variable | Value | Purpose |
| --- | --- | --- |
| `SITE_MODE` | `marketing` (or unset — the default fails closed) | Locks all product routes, disables the product API and all providers. Never set `product` on a public deployment. |
| `NEXT_PUBLIC_SITE_URL` | `https://oriant.ai` (or the preview origin) | Canonical/OG/robots/sitemap base. |
| `NEXT_PUBLIC_DEMO_BOOKING_URL` | optional booking link | If set, the gate's "Request a Guided Demo" opens it in a new tab. |
| `NEXT_PUBLIC_DEMO_CONTACT_EMAIL` | optional | mailto fallback; defaults to `hello@oriant.ai`. |

Do **not** set `AIAND_*`, `NOSANA_*`, `DOUBLEWORD_*`, or `DAYTONA_*`.
Marketing mode ignores them, but they do not belong on this deployment.

## 2. Build and run

```bash
npm ci
npm run build     # builds into .next-build (never clobbers a dev server)
npm start         # serves the production build
```

The dev server (`npm run dev`, port from `.claude/launch.json`) uses `.next`
— never run `npm run build` into the same dir while dev is running.

## 3. What enforces the lock

- `middleware.ts` — edge 307 redirect for every non-public path to
  `/?demo=locked&source=<sanitized-key>`; normalizes case/encoding/slashes.
- `app/app/layout.tsx`, `app/demo/layout.tsx`, `app/onboarding/page.tsx` —
  request-time `redirect()` guards (`force-dynamic`).
- `lib/server/store.ts` — product API state store throws in marketing mode.
- `lib/server/providers/env.ts` — providers report absent in marketing mode.
- `next.config.mjs` — CSP, HSTS, nosniff, frame-deny, restrictive
  Permissions-Policy (camera/microphone/geolocation/payment all disabled),
  `poweredByHeader: false`, no production browser source maps.
- `app/robots.ts` / `app/sitemap.ts` — public URLs only; private prefixes
  disallowed.

The demo gate itself: `components/landing/DemoGateModal.tsx` (+
`DemoGateController`, `DemoGateLink`, `LockedProductPreview`), state in
`lib/demo-gate.ts`, copy in `lib/landing-content.ts` (`DEMO_GATE`), contact
resolution in `lib/contact-config.ts`, route policy in
`lib/route-policy.ts`.

## 4. Preview assets

`public/previews/*.webp` are screenshots of the hardcoded mock with
fictional BrightPath Home Services data, downscaled and **pre-blurred at
export** so no text is readable even if the file is opened directly. To
regenerate: run the mock locally in product mode, fast-forward to "Active
workspace" via the top-bar demo menu, capture at 1600x1000+, blur (sigma
~3 at 1600w), export webp, and keep the same five filenames.

## 5. Preflight checklist (fresh incognito profile)

1. `/` renders the full landing page; no gate on load; no console errors.
2. Every "Start Free Discovery" button (navbar, hero, final CTA, footer)
   opens the gate over the blurred preview; the URL does not navigate away.
3. Paste each private URL: `/app/onboarding`, `/app/planner`, `/demo`,
   `/onboarding`, `/discovery`, `/workspace`, `/dashboard`, `/settings`,
   `/api/state` → all land on `/?demo=locked&source=<key>` with the gate
   open and the matching preview behind it.
4. Case/encoding variants: `/APP/Onboarding/`, `/%61pp/planner`,
   `//app//workspace` → same locked redirect.
5. Disable JavaScript, open `/app/workspace` → server redirect still lands
   on the landing page (the gate needs JS, but no private content renders).
6. Gate keyboard test: focus lands in the panel, Tab cycles inside it,
   Escape closes, focus returns to the triggering button, page scroll is
   locked while open, closing a `?demo=locked` visit cleans the URL.
7. Reduced motion: gate fades only.
8. "Request a Guided Demo" opens the configured booking page or a mailto
   draft; the button is never dead.
9. View source of `/`: no `/app/` hrefs, no fixture names, no provider
   names. Check `curl -I` for the security headers.
10. `/robots.txt` and `/sitemap.xml` list only public URLs.
11. Run Lighthouse (performance / a11y / best practices / SEO) at 1440,
    1024, 768 and 390 widths; fix material regressions.

## 6. Recommended final hardening (owner approval needed)

Physically remove the private code from this branch so the public build
contains no product bundles at all (everything is preserved on
`backup/full-product-mock`):

```bash
git rm -r app/app app/demo app/onboarding app/api components/mock \
  components/screens components/AppShell.tsx components/Landing.tsx \
  components/MargoApp.tsx lib/mock lib/server lib/contracts.ts \
  lib/fixtures.ts lib/script.ts lib/speech.ts lib/store.ts lib/ui.ts \
  lib/vals.ts reference
```

Afterwards delete the now-unused guards' imports if TypeScript flags them,
re-run `npx tsc --noEmit && npm run build`, and confirm the route table
lists only `/`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml` and
`/_not-found`.
