/**
 * site-mode.ts — the single server-side switch between the two deployments
 * this repo can be (marketing hardening spec §14).
 *
 * SITE_MODE=marketing → marketing-only: every private route is locked behind
 *                       the landing page's demo gate, and the CTA buttons open
 *                       the gate instead of navigating.
 * anything else       → the PRODUCT: /app is reachable and the landing CTAs
 *                       navigate into it.
 *
 * THE DEFAULT IS THE PRODUCT, and that is a deliberate reversal of this file's
 * first version. The marketing lock was written while the product behind it was
 * unfinished; failing closed to marketing was right then, because an unset
 * variable exposing a half-built product was the dangerous direction. The
 * product has since shipped (ROLE_C_PLAN M0–M7, all verified), the two lanes
 * were merged, and this deployment's job is to BE the product — so an unset
 * variable now means the product, and the marketing-only posture is what you
 * must ask for by name. A dedicated marketing deployment sets
 * SITE_MODE=marketing and gets the entire lock machinery unchanged.
 *
 * Unrecognised values fall to the product rather than refusing, because this
 * switch chooses between two working deployments rather than arming anything —
 * the posture lib/runtime/session.ts takes for ORIANT_RUNTIME_MODE, not the
 * throwing posture it takes for ORIANT_RUNTIME_STORAGE.
 *
 * Never expose this via NEXT_PUBLIC_. Safe in every runtime (edge middleware,
 * server components, route handlers).
 */
export function isMarketingSite(): boolean {
  return process.env.SITE_MODE === "marketing";
}
