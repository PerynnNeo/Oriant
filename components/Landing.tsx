"use client";
import { useApp } from "@/lib/store";
import { sx } from "@/lib/ui";

const steps = [
  { n: "01", title: "Share the business snapshot", body: "Company basics, team shape, goals, tools, and any documents you already have." },
  { n: "02", title: "Choose your discovery style", body: "Voice conversation, chat conversation, or more documentation before we continue." },
  { n: "03", title: "Approve the business blueprint", body: "Review what Margo learned about your business before any planning starts." },
  { n: "04", title: "Shape the AI workforce plan", body: "Select workflows, configure responsibilities, and keep every approval gate explicit." },
];

const pillars = [
  { title: "Outcome first", body: "The product is framed around business outcomes, not technical agent jargon." },
  { title: "Approval-led", body: "Nothing important moves forward without an owner-approved version." },
  { title: "Built for SMEs", body: "Solo founders, lean teams, and growing operators can all start from the same flow." },
];

export default function Landing() {
  const s = useApp();

  return (
    <div style={sx({ animation: "fadeUp .45s ease both" })}>
      <div style={sx({ background: "var(--ink)", color: "var(--paper)", overflow: "hidden", whiteSpace: "nowrap", borderBottom: "1px solid var(--ink)" })}>
        <div style={sx({ display: "inline-flex", gap: 34, padding: "10px 0", fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", animation: "marq 34s linear infinite" })}>
          <span>AI business consultant for small businesses</span>
          <span>Discover operations before automating</span>
          <span>Design the right AI workforce</span>
          <span>Keep the owner in control</span>
          <span>AI business consultant for small businesses</span>
          <span>Discover operations before automating</span>
          <span>Design the right AI workforce</span>
          <span>Keep the owner in control</span>
        </div>
      </div>

      <nav style={sx({ position: "sticky", top: 0, zIndex: 50, background: "rgba(244,238,227,.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--line)" })}>
        <div style={sx({ maxWidth: 1180, margin: "0 auto", padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 })}>
          <div style={sx({ display: "flex", alignItems: "center", gap: 10 })}>
            <span style={sx({ width: 11, height: 11, borderRadius: "50%", background: "var(--ink)", display: "inline-block" })} />
            <span style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: 22, letterSpacing: "-.02em" })}>Margo</span>
          </div>
          <div style={sx({ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" })}>
            <a href="#how" style={sx({ fontSize: 14 })}>How it works</a>
            <a href="#why" style={sx({ fontSize: 14 })}>Why Margo</a>
            <button
              onClick={s.enterApp}
              className="hv-bg"
              style={sx({ background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 999, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", "--hv-bg": "var(--ember)" })}
            >
              Start business discovery →
            </button>
          </div>
        </div>
      </nav>

      <header style={sx({ maxWidth: 1180, margin: "0 auto", padding: "72px 40px 44px", display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 36, alignItems: "end" })}>
        <div>
          <div style={sx({ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ember)" })}>Business Discovery Platform</div>
          <h1 style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: "clamp(48px,8vw,98px)", lineHeight: 0.9, letterSpacing: "-.04em", margin: "18px 0 0", maxWidth: "11ch" })}>Learn the business before you automate it.</h1>
          <p style={sx({ fontSize: 19, lineHeight: 1.55, color: "var(--ink2)", maxWidth: "42ch", margin: "24px 0 0" })}>Margo helps small businesses map how work really happens, identify the highest-value AI opportunities, and turn that into a safe, editable workforce plan with human approval at every important step.</p>
          <div style={sx({ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" })}>
            <button
              onClick={s.enterApp}
              className="hv-bg"
              style={sx({ background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 999, padding: "16px 28px", fontSize: 15.5, fontWeight: 600, cursor: "pointer", "--hv-bg": "var(--ember)" })}
            >
              Start business discovery →
            </button>
            <button
              onClick={s.enterApp}
              className="hv-bd"
              style={sx({ background: "transparent", color: "var(--ink)", border: "1px solid var(--line2)", borderRadius: 999, padding: "16px 26px", fontSize: 15.5, fontWeight: 600, cursor: "pointer", "--hv-bd": "var(--ink)" })}
            >
              Preview the workflow
            </button>
          </div>
        </div>

        <div style={sx({ position: "relative", minHeight: 360, background: "linear-gradient(135deg, rgba(181,93,53,.12), rgba(54,104,74,.08))", border: "1px solid var(--line)", borderRadius: 24, padding: 24, overflow: "hidden" })}>
          <div style={sx({ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(-45deg,transparent 0 14px,rgba(26,23,18,.03) 14px 15px)" })} />
          <div style={sx({ position: "relative", display: "grid", gap: 14 })}>
            <div style={sx({ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16, padding: 18, boxShadow: "0 18px 40px -26px rgba(26,23,18,.4)" })}>
              <div style={sx({ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)" })}>Step 1</div>
              <div style={sx({ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 24, marginTop: 8 })}>Business Snapshot</div>
              <div style={sx({ fontSize: 14, color: "var(--ink2)", marginTop: 6, lineHeight: 1.5 })}>Company context, team roles, goals, software, and documents before discovery begins.</div>
            </div>
            <div style={sx({ background: "var(--ink)", color: "var(--paper)", borderRadius: 16, padding: 18, marginLeft: 36, boxShadow: "0 18px 40px -26px rgba(26,23,18,.5)" })}>
              <div style={sx({ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.65 })}>Step 2</div>
              <div style={sx({ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 24, marginTop: 8 })}>Guided Discovery</div>
              <div style={sx({ fontSize: 14, opacity: 0.84, marginTop: 6, lineHeight: 1.5 })}>Voice or chat-based discovery that asks smarter follow-up questions because the basics are already known.</div>
            </div>
            <div style={sx({ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16, padding: 18, maxWidth: 300 })}>
              <div style={sx({ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--forest)" })}>Then</div>
              <div style={sx({ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 24, marginTop: 8 })}>Approve the blueprint</div>
              <div style={sx({ fontSize: 14, color: "var(--ink2)", marginTop: 6, lineHeight: 1.5 })}>Nothing goes into planning until the owner signs off on what Margo learned.</div>
            </div>
          </div>
        </div>
      </header>

      <section id="how" style={sx({ maxWidth: 1180, margin: "0 auto", padding: "36px 40px 28px" })}>
        <div style={sx({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap" })}>
          <div>
            <div style={sx({ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ember)" })}>How it works</div>
            <h2 style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: "clamp(34px,5vw,58px)", lineHeight: 0.96, letterSpacing: "-.03em", margin: "14px 0 0", maxWidth: "16ch" })}>A calmer workflow for designing AI operations.</h2>
          </div>
          <p style={sx({ fontSize: 15, color: "var(--ink2)", maxWidth: "34ch", margin: 0 })}>The flow starts with context, not a surprise voice step. That makes discovery smarter and planning much more useful.</p>
        </div>

        <div style={sx({ marginTop: 38, borderTop: "1px solid var(--line2)" })}>
          {steps.map((step) => (
            <div key={step.n} style={sx({ display: "grid", gridTemplateColumns: "88px 1fr 1.2fr", gap: 26, padding: "24px 12px", borderBottom: "1px solid var(--line)", alignItems: "baseline" })}>
              <div style={sx({ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink3)" })}>{step.n}</div>
              <h3 style={sx({ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 23, letterSpacing: "-.01em", margin: 0 })}>{step.title}</h3>
              <p style={sx({ margin: 0, fontSize: 15.5, color: "var(--ink2)", lineHeight: 1.5 })}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="why" style={sx({ background: "var(--paper2)", borderTop: "1px solid var(--line)", marginTop: 62 })}>
        <div style={sx({ maxWidth: 1180, margin: "0 auto", padding: "74px 40px" })}>
          <div style={sx({ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ember)" })}>Why Margo</div>
          <h2 style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: "clamp(34px,5vw,56px)", lineHeight: 0.96, letterSpacing: "-.03em", margin: "14px 0 0", maxWidth: "15ch" })}>A business consultant experience, not another AI toy.</h2>
          <div style={sx({ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 34 })}>
            {pillars.map((pillar) => (
              <div key={pillar.title} style={sx({ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: 22 })}>
                <div style={sx({ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 24 })}>{pillar.title}</div>
                <p style={sx({ margin: "10px 0 0", fontSize: 14.5, color: "var(--ink2)", lineHeight: 1.55 })}>{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={sx({ background: "var(--ink)", color: "var(--paper)" })}>
        <div style={sx({ maxWidth: 1180, margin: "0 auto", padding: "72px 40px 40px" })}>
          <div style={sx({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap" })}>
            <div>
              <div style={sx({ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.55 })}>Ready when you are</div>
              <div style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: "clamp(38px,6.4vw,84px)", lineHeight: 0.9, letterSpacing: "-.03em", marginTop: 14 })}>Start with the business.</div>
            </div>
            <button
              onClick={s.enterApp}
              className="hv-bg hv-fg"
              style={sx({ background: "var(--paper)", color: "var(--ink)", border: "none", borderRadius: 999, padding: "17px 30px", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", "--hv-bg": "var(--ember)", "--hv-fg": "var(--paper)" })}
            >
              Start business discovery →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
