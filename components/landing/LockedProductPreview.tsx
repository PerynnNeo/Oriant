"use client";
/**
 * LockedProductPreview — the sanitized, non-interactive product backdrop
 * behind the demo gate (marketing hardening spec §5, Appendix C).
 *
 * Renders a STATIC screenshot (fictional demo data, pre-blurred at export)
 * under a soft navy scrim. It is decorative: aria-hidden, pointer-events
 * none, unselectable, never focusable. The real product UI is never
 * mounted here.
 */
import { DEMO_GATE } from "@/lib/landing-content";
import type { PreviewSource } from "@/lib/preview-source";
import styles from "./DemoGate.module.css";

export default function LockedProductPreview({
  source,
}: {
  source: PreviewSource;
}) {
  const preview = DEMO_GATE.previews[source] ?? DEMO_GATE.previews.generic;
  return (
    <div className={styles.preview} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative
          full-bleed backdrop; plain img keeps the modal dependency-free */}
      <img
        className={styles.previewImg}
        src={preview.src}
        alt=""
        width={preview.width}
        height={preview.height}
        draggable={false}
      />
      <div className={styles.scrim} />
    </div>
  );
}
