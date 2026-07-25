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

function QuerySync() {
  const params = useSearchParams();
  const openGate = useDemoGate((s) => s.openGate);
  const openedOnce = useRef(false);

  useEffect(() => {
    if (openedOnce.current) return;
    if (params.get("demo") !== "locked") return;
    openedOnce.current = true;
    openGate({
      source: sanitizePreviewSource(params.get("source")),
      variant: "direct",
      fromQuery: true,
    });
  }, [params, openGate]);

  return null;
}

export default function DemoGateController() {
  return (
    <Suspense fallback={null}>
      <QuerySync />
    </Suspense>
  );
}
