/**
 * route-policy.ts — the single authoritative route policy for the
 * marketing-only deployment (marketing hardening spec §3, §11).
 *
 * Consumed by middleware.ts (edge), app/robots.ts and app/sitemap.ts.
 * SERVER-SIDE ONLY: client code imports the preview-key vocabulary from
 * lib/preview-source.ts instead, so the private route taxonomy below
 * never ships in a browser bundle. Pure functions and constants only.
 */
import {
  lockedGateHref,
  sanitizePreviewSource,
  type PreviewSource,
} from "@/lib/preview-source";

export { lockedGateHref, sanitizePreviewSource, type PreviewSource };

/** Pages that render in the public marketing deployment. */
export const PUBLIC_PAGES = ["/", "/privacy", "/terms"] as const;

/** Exact non-page paths that must never trigger the demo gate. */
const PUBLIC_FILES = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
]);

/** Framework and static-asset prefixes (public/ folders + Next internals). */
const PUBLIC_PREFIXES = [
  "/_next",
  "/brand",
  "/previews",
  "/video",
  "/videos",
  "/images",
] as const;

/** Real private mount points, disallowed in robots.txt as an extra signal.
    Deliberately ONLY the mounts that ever existed publicly — enumerating
    the full internal feature taxonomy would advertise it. */
export const PRIVATE_ROUTE_PREFIXES = [
  "/app",
  "/api",
  "/demo",
  "/onboarding",
] as const;

/** Attempted-route → preview key map (spec §11). First match wins. */
const SOURCE_RULES: { prefixes: readonly string[]; source: PreviewSource }[] = [
  {
    prefixes: [
      "/app/onboarding",
      "/app/discovery",
      "/discovery",
      "/onboarding",
      "/lean-canvas",
      "/interview",
      "/report",
    ],
    source: "discovery",
  },
  {
    prefixes: [
      "/app/planner",
      "/app/build",
      "/planner",
      "/workforce",
      "/agents",
      "/build",
    ],
    source: "planner",
  },
  {
    prefixes: [
      "/app/integrations",
      "/tools",
      "/integrations",
      "/connections",
      "/settings",
      "/usage",
    ],
    source: "integrations",
  },
  {
    prefixes: [
      "/app/workspace",
      "/app/sandbox",
      "/app/deploy",
      "/demo",
      "/activation",
      "/workspace",
      "/calendar",
      "/dashboard",
      "/approvals",
      "/sandbox",
      "/deploy",
    ],
    source: "operations",
  },
];

/** Canonicalize before any policy decision: decode once, lowercase,
    normalize backslashes, then RESOLVE `.`/`..` segments so a path like
    "/previews/../app/x" can never ride an asset prefix past the guard
    (fail-closed canonicalization). "/APP//Onboarding/" → "/app/onboarding". */
export function normalizePath(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* malformed escapes stay as-is; still lowercased + matched below */
  }
  path = path.toLowerCase().replace(/\\/g, "/");
  const resolved: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return `/${resolved.join("/")}`;
}

function startsWithSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Is this path allowed in the public marketing deployment?
    Expects a normalized path. */
export function isPublicPath(path: string): boolean {
  if ((PUBLIC_PAGES as readonly string[]).includes(path)) return true;
  if (PUBLIC_FILES.has(path)) return true;
  return PUBLIC_PREFIXES.some((p) => startsWithSegment(path, p));
}

/** Sanitized preview key for an attempted private path (never the raw URL). */
export function previewSourceFor(path: string): PreviewSource {
  for (const rule of SOURCE_RULES) {
    if (rule.prefixes.some((p) => startsWithSegment(path, p))) {
      return rule.source;
    }
  }
  return "generic";
}
