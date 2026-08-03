"use client";
/**
 * DemoGateController — opens the demo gate from the server guard's safe
 * query state (?demo=locked&source=<key>, marketing hardening spec §4).
 * The source value is parsed against the fixed key list; anything else
 * falls back to "generic". Raw query values are never rendered.
 *
 * useSearchParams requires a Suspense boundary, hence the split export.
 */
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { sanitizePreviewSource } from "@/lib/preview-source";
import { useDemoGate } from "@/lib/demo-gate";

function QuerySync({ gateEnabled }: { gateEnabled: boolean }) {
  const params = useSearchParams();
  const openGate = useDemoGate((s) => s.openGate);
  const setEnabled = useDemoGate((s) => s.setEnabled);
  const openedOnce = useRef(false);

  /* The server resolved SITE_MODE; tell the client store before anything can
     open. On the product deployment this turns every DemoGateLink into an
     ordinary link, and a stale ?demo=locked bookmark from the marketing era
     renders the landing page cleanly instead of a lock over a product. */
  useEffect(() => {
    setEnabled(gateEnabled);
  }, [gateEnabled, setEnabled]);

  useEffect(() => {
    if (!gateEnabled) return;
    if (openedOnce.current) return;
    if (params.get("demo") !== "locked") return;
    openedOnce.current = true;
    openGate({
      source: sanitizePreviewSource(params.get("source")),
      variant: "direct",
      fromQuery: true,
    });
  }, [gateEnabled, params, openGate]);

  return null;
}

export default function DemoGateController({
  gateEnabled,
}: {
  /** Server-resolved `isMarketingSite()`; the page passes it down because
      this is a client component and SITE_MODE must never be NEXT_PUBLIC_. */
  gateEnabled: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <QuerySync gateEnabled={gateEnabled} />
    </Suspense>
  );
}
