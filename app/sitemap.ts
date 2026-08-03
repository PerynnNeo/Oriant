/**
 * sitemap.ts — only public marketing pages are listed (spec §12).
 * Private route names must never appear here.
 */
import type { MetadataRoute } from "next";
import { PUBLIC_PAGES } from "@/lib/route-policy";
import { SITE_URL } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PAGES.map((path) => ({
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "yearly",
    priority: path === "/" ? 1 : 0.3,
  }));
}
