"use client";
/**
 * demo-gate.ts — the ONE shared state behind every "Start Free Discovery"
 * entry point and the ?demo=locked query handler (marketing hardening
 * spec §4). Buttons call openGate(); the modal renders from this store;
 * nothing else duplicates gate logic.
 *
 * variant:
 *   "cta"    — visitor clicked a discovery CTA on the landing page.
 *   "direct" — visitor typed/followed a private URL and was redirected
 *              by the server guard (slightly more specific copy).
 */
import { create } from "zustand";
import type { PreviewSource } from "@/lib/preview-source";

export type DemoGateVariant = "cta" | "direct";

interface DemoGateStore {
  open: boolean;
  source: PreviewSource;
  variant: DemoGateVariant;
  /**
   * Whether this deployment locks at all. The server resolves it from
   * SITE_MODE (lib/site-mode.ts) and DemoGateController writes it here once;
   * on the product deployment the CTAs are ordinary links and the gate never
   * opens. Defaults TRUE — until the server has spoken, a marketing deployment
   * must not flash a click's worth of unlocked navigation.
   */
  enabled: boolean;
  /** Control that opened the gate; focus returns to it on close. */
  returnFocus: HTMLElement | null;
  /** True when opened from ?demo=locked — closing must clean the URL. */
  fromQuery: boolean;
  setEnabled: (enabled: boolean) => void;
  openGate: (opts?: {
    source?: PreviewSource;
    variant?: DemoGateVariant;
    trigger?: HTMLElement | null;
    fromQuery?: boolean;
  }) => void;
  closeGate: () => void;
}

export const useDemoGate = create<DemoGateStore>()((set) => ({
  open: false,
  source: "discovery",
  variant: "cta",
  enabled: true,
  returnFocus: null,
  fromQuery: false,
  setEnabled: (enabled) => set({ enabled }),
  openGate: (opts) =>
    set({
      open: true,
      source: opts?.source ?? "discovery",
      variant: opts?.variant ?? "cta",
      returnFocus: opts?.trigger ?? null,
      fromQuery: opts?.fromQuery ?? false,
    }),
  closeGate: () => set({ open: false }),
}));
