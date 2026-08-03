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
  /** Control that opened the gate; focus returns to it on close. */
  returnFocus: HTMLElement | null;
  /** True when opened from ?demo=locked — closing must clean the URL. */
  fromQuery: boolean;
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
  returnFocus: null,
  fromQuery: false,
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
