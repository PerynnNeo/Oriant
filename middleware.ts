/**
 * middleware.ts — server-side route guard for the marketing-only
 * deployment (marketing hardening spec §8).
 *
 * Every request that is not on the public allowlist is 307-redirected to
 * the root landing page with the demo gate opened via safe query state
 * (?demo=locked&source=<sanitized-key>). The redirect happens at the
 * server edge, so a private page can never flash, render without
 * JavaScript, or be reached from history/incognito.
 *
 * SITE_MODE=product (local/internal only) disables the guard so the full
 * product mock stays usable in development; the default fails closed.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicPath,
  lockedGateHref,
  normalizePath,
  previewSourceFor,
} from "@/lib/route-policy";
import { isMarketingSite } from "@/lib/site-mode";

export function middleware(request: NextRequest) {
  if (!isMarketingSite()) return NextResponse.next();

  const path = normalizePath(request.nextUrl.pathname);
  if (isPublicPath(path)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/";
  // Drop the attempted path and its query entirely; only the sanitized
  // preview key survives into the redirect (never the raw URL).
  url.search = "";
  const target = new URL(lockedGateHref(previewSourceFor(path)), url);
  return NextResponse.redirect(target, 307);
}

export const config = {
  /* Everything except Next's immutable static output; public files and
     framework assets are allowlisted inside the handler instead so that
     unknown paths always reach the guard. */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
