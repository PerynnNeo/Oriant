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
  const enabled = useDemoGate((s) => s.enabled);
  return (
    <a
      href={CTA.primary.href}
      className={className}
      onClick={(e) => {
        /* On the product deployment the gate is disabled and this is an
           ordinary link into the product. Before hydration it is a plain
           anchor either way, and the server middleware enforces whichever
           mode is real — this interception is UX, never the lock itself. */
        if (!enabled) return;
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
