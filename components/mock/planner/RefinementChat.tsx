"use client";
/**
 * RefinementChat — real Workforce Plan refinement (item 10). Replaces
 * CommandBar's local keyword-fixture behavior for real, server-backed plans
 * (planId set); CommandBar keeps running the pure "Interactive Demo" path
 * unchanged (see PlannerExperience.tsx).
 *
 * "AI proposes, code applies": every request produces a reviewable diff the
 * owner must explicitly Apply — nothing changes until then. If the current
 * plan is already approved, applying a diff creates a new draft version
 * instead of mutating the approved one (immutability, per the blueprint).
 */
import { useState } from "react";
import { Loader2, Send, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { toast } from "@/components/mock/ui/Toaster";
import { useDemoStore } from "@/lib/mock/store";
import { money } from "@/lib/mock/pricing";
import type { RefinementDiff } from "@/lib/server/b/refine";
import styles from "./planner.module.css";

const EFFECT_LABEL: Record<RefinementDiff["effects"][number]["kind"], string> = {
  add_rule: "Add plan rule",
  remove_agent: "Remove agent",
  set_approval: "Add approval requirement",
  note: "Note (no structural change)",
};

function effectDescription(effect: RefinementDiff["effects"][number]): string {
  switch (effect.kind) {
    case "add_rule":
      return effect.rule;
    case "remove_agent":
      return effect.agentName || effect.agentId;
    case "set_approval":
      return `${effect.agentName || effect.agentId}: ${effect.action}`;
    case "note":
      return effect.note;
  }
}

export default function RefinementChat({ approved }: { approved: boolean }) {
  const planId = useDemoStore((s) => s.planId);
  const plan = useDemoStore((s) => s.plan);
  const refinementCount = (plan as { refinementMessageCount?: number }).refinementMessageCount ?? 0;

  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<RefinementDiff | null>(null);
  const [applying, setApplying] = useState(false);

  if (!planId) return null;

  const propose = async () => {
    const text = instruction.trim();
    if (!text || loading) return;
    setLoading(true);
    setDiff(null);
    try {
      const res = await fetch(`/api/workforce-plan/${planId}/refine/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text }),
      });
      const body = (await res.json()) as { diff?: RefinementDiff; error?: string };
      if (!res.ok || !body.diff) throw new Error(body.error ?? "Something went wrong proposing this change.");
      setDiff(body.diff);
      setInstruction("");
    } catch (err) {
      toast({ title: "Couldn't propose that change", detail: err instanceof Error ? err.message : String(err), tone: "info" });
    } finally {
      setLoading(false);
    }
  };

  const discard = () => setDiff(null);

  const apply = async () => {
    if (!diff) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/workforce-plan/${planId}/refine/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff }),
      });
      const body = (await res.json()) as {
        plan?: { id: string; plan: unknown };
        newVersionCreated?: boolean;
        error?: string;
      };
      if (!res.ok || !body.plan) throw new Error(body.error ?? "Something went wrong applying this change.");

      useDemoStore.setState({ plan: body.plan.plan as never, planId: body.plan.id });
      setDiff(null);
      toast({
        title: body.newVersionCreated ? "New draft version created" : "Change applied",
        detail: body.newVersionCreated
          ? "The approved plan wasn't touched — review and re-approve this new draft to continue."
          : diff.summary,
        tone: "ok",
      });
    } catch (err) {
      toast({ title: "Couldn't apply that change", detail: err instanceof Error ? err.message : String(err), tone: "info" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={styles.commandBar} aria-label="Workforce plan refinement">
      {diff ? (
        <div className={styles.gateSection} role="status">
          <p className="oa-micro">Proposed change</p>
          <p style={{ margin: "4px 0 8px" }}>{diff.summary}</p>
          <ul className={styles.insList}>
            {diff.effects.map((e, i) => (
              <li key={i} className={styles.insItem}>
                <strong>{EFFECT_LABEL[e.kind]}:</strong>&nbsp;{effectDescription(e)}
              </li>
            ))}
          </ul>
          <p className={styles.gateCostRow} style={{ margin: "6px 0" }}>
            <span>Estimated cost impact</span>
            <span>
              {diff.costDelta.setup >= 0 ? "+" : ""}
              {money(diff.costDelta.setup)} setup ·{" "}
              {diff.costDelta.monthly >= 0 ? "+" : ""}
              {money(diff.costDelta.monthly)}/mo
            </span>
          </p>
          {diff.riskNote && (
            <p className="oa-sub" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <TriangleAlert size={13} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
              {diff.riskNote}
            </p>
          )}
          {diff.requiresReapproval && (
            <p className="oa-sub" style={{ display: "flex", gap: 6, alignItems: "flex-start", color: "var(--oa-amber-ink, #92400e)" }}>
              <ShieldAlert size={13} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
              This plan is approved — applying will create a new draft version that needs your approval again. The
              currently approved plan stays exactly as it is until then.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="oa-btn oa-btn--ghost oa-btn--sm" onClick={discard} disabled={applying}>
              <X size={13} aria-hidden />
              Discard
            </button>
            <button type="button" className="oa-btn oa-btn--primary oa-btn--sm" onClick={apply} disabled={applying}>
              {applying ? <Loader2 size={13} className="oa-spin" aria-hidden /> : null}
              Apply change
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.cmdRow}>
          <input
            type="text"
            className={styles.cmdInput}
            placeholder={
              approved
                ? "Describe a change, e.g. \"remove the marketing agent\" — creates a new draft to re-approve"
                : "Describe a change, e.g. \"add human approval before any refund action\""
            }
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") propose();
            }}
            disabled={loading}
            aria-label="Describe a plan change"
          />
          <button
            type="button"
            className="oa-btn oa-btn--primary oa-btn--sm"
            onClick={propose}
            disabled={loading || !instruction.trim()}
          >
            {loading ? <Loader2 size={13} className="oa-spin" aria-hidden /> : <Send size={13} aria-hidden />}
            Ask Oriant
          </button>
        </div>
      )}
      <p className="oa-sub" style={{ marginTop: 6 }}>
        {refinementCount}/{30} refinement messages used for this plan version. Only removing an agent, adding a plan
        rule, or adding an approval requirement are supported — adding agents or integrations requires regenerating
        the plan.
      </p>
    </div>
  );
}
