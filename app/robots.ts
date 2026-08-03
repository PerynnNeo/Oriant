/**
 * robots.ts — marketing deployment robots policy (spec §12). Only public
 * pages are crawlable; legacy private prefixes are disallowed as an extra
 * signal (robots.txt is a hint, not security — the middleware guard is
 * the real control).
 */
import type { MetadataRoute } from "next";
import { PRIVATE_ROUTE_PREFIXES } from "@/lib/route-policy";
import { SITE_URL } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_ROUTE_PREFIXES],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
