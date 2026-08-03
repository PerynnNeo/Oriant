/**
 * site-mode.ts — the single server-side switch for the marketing-only
 * deployment (marketing hardening spec §14).
 *
 * SITE_MODE=product  → full product mock is reachable (local/internal only).
 * anything else      → marketing mode: every private route is locked.
 *
 * The default FAILS CLOSED: a deployment with no SITE_MODE env var is a
 * marketing deployment. Never expose this via NEXT_PUBLIC_.
 * Safe in every runtime (edge middleware, server components, route handlers).
 */
export function isMarketingSite(): boolean {
  return process.env.SITE_MODE !== "product";
}
