/**
 * site-config.ts — public origin for canonical/OG/sitemap URLs.
 * Override with NEXT_PUBLIC_SITE_URL for preview deployments.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://oriant.ai"
).replace(/\/+$/, "");
