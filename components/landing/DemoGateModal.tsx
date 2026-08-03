"use client";
/**
 * DemoGateModal — the guided-demo gate (marketing hardening spec §4-§7).
 *
 * One modal for every entry point: discovery CTAs open it directly and
 * server-redirected private URLs open it via ?demo=locked. Renders over a
 * LockedProductPreview backdrop (static sanitized screenshot; the real
 * product is never mounted).
 *
 * Accessibility contract (spec §4/§5 + test D-10/D-11):
 *  - role="dialog" aria-modal, labelled/described by its own copy;
 *  - focus moves into the panel on open, Tab is trapped, Escape closes,
 *    focus returns to the triggering control on close;
 *  - background scroll locks via html[data-lp-modal] (also neutralises
 *    Lenis, which scrolls the window);
 *  - reduced motion: simple fades, no scale/slide;
 *  - closing a ?demo=locked visit strips the query with replaceState —
 *    no reload, no scroll jump, no raw attempted URL ever shown.
 */
import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { DEMO_GATE } from "@/lib/landing-content";
import { demoContactAction } from "@/lib/contact-config";
import { useDemoGate } from "@/lib/demo-gate";
import { EASE } from "./motion";
import LockedProductPreview from "./LockedProductPreview";
import styles from "./DemoGate.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DemoGateModal() {
  const { open, source, variant, returnFocus, fromQuery, closeGate } =
    useDemoGate();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contact = demoContactAction();

  const close = useCallback(() => {
    closeGate();
    if (fromQuery && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("demo") || url.searchParams.has("source")) {
        url.searchParams.delete("demo");
        url.searchParams.delete("source");
        window.history.replaceState(null, "", url.pathname + url.hash);
      }
    }
    if (returnFocus && returnFocus.isConnected) {
      returnFocus.focus({ preventScroll: true });
    }
  }, [closeGate, fromQuery, returnFocus]);

  /* Scroll lock + initial focus + key handling while open. */
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    html.setAttribute("data-lp-modal", "1");
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true });
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      /* The panel wrapper itself (initial focus target) counts as the
         boundary in both directions, so Shift+Tab can never escape. */
      if (e.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      html.removeAttribute("data-lp-modal");
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  const title = DEMO_GATE.title[variant];
  const body = DEMO_GATE.body[variant];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          role="presentation"
          data-lenis-prevent
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.24, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: EASE } }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <LockedProductPreview source={source} />

          <motion.div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lp-demo-gate-title"
            aria-describedby="lp-demo-gate-body"
            tabIndex={-1}
            initial={
              reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.965 }
            }
            animate={
              reduced
                ? { opacity: 1, transition: { duration: 0.2 } }
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.28, ease: EASE, delay: 0.05 },
                  }
            }
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0.15 } }
                : {
                    opacity: 0,
                    y: 10,
                    scale: 0.975,
                    transition: { duration: 0.16, ease: EASE },
                  }
            }
          >
            <button
              type="button"
              className={styles.close}
              aria-label="Close"
              onClick={close}
            >
              <X size={17} strokeWidth={2} aria-hidden="true" />
            </button>

            <p className={`lp-micro ${styles.eyebrow}`}>{DEMO_GATE.eyebrow}</p>
            <h2 id="lp-demo-gate-title" className={styles.title}>
              {title}
            </h2>
            <p id="lp-demo-gate-body" className={styles.body}>
              {body}
            </p>
            <p className={styles.supporting}>{DEMO_GATE.supporting}</p>

            <div className={styles.actions}>
              <a
                href={contact.href}
                className={`lp-btn lp-btn--primary ${styles.actionBtn}`}
                {...(contact.kind === "booking"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {DEMO_GATE.primaryLabel}
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              </a>
              <button
                type="button"
                className={`lp-btn lp-btn--ghost ${styles.actionBtn}`}
                onClick={close}
              >
                {DEMO_GATE.secondaryLabel}
              </button>
            </div>

            <p className={styles.note}>{DEMO_GATE.note}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
