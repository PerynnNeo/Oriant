import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "./app.css";
import AppShell from "@/components/mock/shell/AppShell";
import { isMarketingSite } from "@/lib/site-mode";
import { lockedGateHref } from "@/lib/route-policy";

export const metadata: Metadata = {
  title: "Oriant.ai - Workspace",
  description:
    "Interactive product demo: guided discovery, an approvable company report, an AI workforce plan, sandbox testing and an owner-controlled operations workspace.",
  robots: { index: false },
};

/* Marketing hardening: evaluated per request (never prerendered), so the
   SITE_MODE guard below always runs server-side — defense in depth behind
   the middleware redirect. */
export const dynamic = "force-dynamic";

export default function MockAppLayout({ children }: { children: React.ReactNode }) {
  if (isMarketingSite()) redirect(lockedGateHref("generic"));
  return <AppShell>{children}</AppShell>;
}
