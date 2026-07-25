/**
 * preview-source.ts — the sanitized preview-key vocabulary shared by the
 * server route policy and the CLIENT demo gate. Kept separate from
 * lib/route-policy.ts on purpose: client components import from here, so
 * the private route taxonomy in route-policy never reaches the browser
 * bundle. Keys are the ONLY values ever placed in a URL or read back from
 * one; raw attempted paths are never echoed anywhere.
 */

export const PREVIEW_SOURCES = [
  "discovery",
  "planner",
  "operations",
  "integrations",
  "generic",
] as const;
export type PreviewSource = (typeof PREVIEW_SOURCES)[number];

/** Parse an untrusted query value back into a known preview key. */
export function sanitizePreviewSource(value: string | null): PreviewSource {
  return (PREVIEW_SOURCES as readonly string[]).includes(value ?? "")
    ? (value as PreviewSource)
    : "generic";
}

/** Root-relative locked-gate URL for a given preview key. */
export function lockedGateHref(source: PreviewSource): string {
  return `/?demo=locked&source=${source}`;
}
