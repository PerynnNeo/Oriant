"use client";
/**
 * DemoGateLink — the one way a discovery CTA renders (marketing hardening
 * spec §4, §10). Looks and lays out exactly like the anchor it replaces;
 * a plain click opens the centralized demo gate instead of navigating.
 * The href stays meaningful (server-locked root query state) so modifier
 * clicks, new tabs, and no-JS visitors land on the same locked experience.
 */
import { type ReactNode } from "react";
import { CTA } from "@/lib/landing-content";
import { useDemoGate } from "@/lib/demo-gate";
import type { PreviewSource } from "@/lib/preview-source";

export default function DemoGateLink({
  className,
  children,
  source = "discovery",
}: {
  className?: string;
  children: ReactNode;
  source?: PreviewSource;
}) {
  const openGate = useDemoGate((s) => s.openGate);
  return (
    <a
      href={CTA.primary.href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
          return;
        e.preventDefault();
        openGate({ source, variant: "cta", trigger: e.currentTarget });
      }}
    >
      {children}
    </a>
  );
}
