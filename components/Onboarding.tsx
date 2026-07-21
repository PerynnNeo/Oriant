"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { sx } from "@/lib/ui";

const sizeOptions = [
  "Solo business",
  "2-10 employees",
  "11-50 employees",
  "50+ employees",
];

const automationOptions = [
  "Assist my team",
  "Work alongside my team where appropriate",
  "Automate as much as possible",
  "Fully automate my business",
  "I'm not sure yet (Recommend the best approach)",
];

const discoveryOptions = [
  {
    id: "voice",
    title: "Voice Conversation",
    body: "Start one guided discovery session with our AI Business Consultant. You can speak naturally or type in the same chat interface at any point.",
    cta: "Start Voice Conversation",
  },
];

function ChipGroup(props: {
  items: Record<string, boolean>;
  builtInItems: string[];
  onToggle: (key: string) => void;
  activeStyle?: "dark" | "soft";
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  onOtherAdd?: () => void;
  onCustomRename?: (oldKey: string, nextKey: string) => void;
  onCustomDelete?: (key: string) => void;
}) {
  const activeStyle = props.activeStyle ?? "soft";
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const builtIn = new Set(props.builtInItems);
  return (
    <div style={sx({ display: "grid", gap: 10 })}>
      <div style={sx({ display: "flex", flexWrap: "wrap", gap: 10 })}>
      {Object.keys(props.items).map((item) => {
        const on = props.items[item];
        const isCustom = !builtIn.has(item) && item !== "Other" && item !== "Upload";
        const isEditing = editingKey === item;
        return (
          <div
            key={item}
            style={sx(
              activeStyle === "dark"
                ? {
                    position: "relative",
                    border: `1px solid ${on ? "var(--ink)" : "var(--line2)"}`,
                    background: on ? "var(--ink)" : "var(--card)",
                    color: on ? "var(--paper)" : "var(--ink)",
                    borderRadius: 18,
                    padding: isCustom ? "15px 36px 10px 15px" : "10px 15px",
                    fontSize: 13.5,
                  }
                : {
                    position: "relative",
                    border: `1px solid ${on ? "var(--forest)" : "var(--line2)"}`,
                    background: on ? "rgba(54,104,74,.08)" : "var(--card)",
                    color: "var(--ink)",
                    borderRadius: 18,
                    padding: isCustom ? "15px 36px 10px 15px" : "10px 15px",
                    fontSize: 13.5,
                  },
            )}
          >
            {isCustom && (
              <button
                onClick={() => {
                  setEditingKey(item);
                  setEditingValue(item);
                }}
                title="Edit option"
                style={sx({ position: "absolute", right: 20, top: 5, background: "transparent", border: "none", padding: 0, fontSize: 11, lineHeight: 1, cursor: "pointer", color: on ? "var(--paper)" : "var(--ink3)" })}
              >
                ✎
              </button>
            )}
            <button
              onClick={() => props.onToggle(item)}
              className="hv-tf"
              style={sx({ background: "transparent", color: "inherit", border: "none", padding: 0, fontSize: "inherit", cursor: "pointer", transition: "transform .18s", "--hv-tf": "translateY(-2px)" })}
            >
              {item}
            </button>
            {isCustom && (
              <button
                onClick={() => props.onCustomDelete?.(item)}
                title="Delete option"
                style={sx({ position: "absolute", right: 6, top: 4, background: "transparent", border: "none", padding: 0, fontSize: 12, lineHeight: 1, cursor: "pointer", color: on ? "var(--paper)" : "var(--ink3)" })}
              >
                ×
              </button>
            )}
            {isEditing && (
              <div style={sx({ display: "flex", gap: 8, alignItems: "center", marginTop: 10 })}>
                <input
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      props.onCustomRename?.(item, editingValue);
                      setEditingKey(null);
                    }
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                  style={sx({ border: "1px solid rgba(26,23,18,.15)", background: "rgba(255,255,255,.82)", borderRadius: 10, padding: "8px 10px", fontSize: 13, outline: "none", minWidth: 180, color: "var(--ink)" })}
                />
                <button
                  onClick={() => {
                    props.onCustomRename?.(item, editingValue);
                    setEditingKey(null);
                  }}
                  style={sx({ background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" })}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        );
      })}
      </div>
      {props.items.Other && props.onOtherChange && (
        <div style={sx({ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" })}>
          <input
            value={props.otherValue ?? ""}
            onChange={(e) => props.onOtherChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                props.onOtherAdd?.();
              }
            }}
            placeholder="Enter other manually"
            style={sx({ border: "1px solid var(--line2)", background: "var(--paper)", borderRadius: 12, padding: "12px 14px", fontSize: 14, outline: "none", minWidth: 240, flex: "0 1 320px" })}
          />
          <button
            onClick={props.otherValue?.trim() ? props.onOtherAdd : undefined}
            className={props.otherValue?.trim() ? "hv-bg" : undefined}
            style={sx(
              props.otherValue?.trim()
                ? { background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 999, padding: "11px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", "--hv-bg": "var(--ember)" }
                : { background: "var(--paper3)", color: "var(--ink3)", border: "none", borderRadius: 999, padding: "11px 16px", fontSize: 13, fontWeight: 600, cursor: "default" }
            )}
          >
            Add option
          </button>
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const s = useApp();
  const ob = s.onboarding;
  const [snapshotPanel, setSnapshotPanel] = useState(0);
  const autoAdvanceRef = useRef(-1);
  const rolesPicked = Object.values(ob.teamRoles).some(Boolean);
  const goalsPicked = Object.values(ob.goals).some(Boolean);
  const businessContextPicked =
    Object.values(ob.businessPlatforms).some(Boolean) ||
    Object.values(ob.communications).some(Boolean) ||
    Object.values(ob.marketingSales).some(Boolean) ||
    Object.values(ob.operationsAdmin).some(Boolean);
  const snapshotReady = !!(
    ob.companyName.trim() &&
    ob.industry.trim() &&
    ob.region.trim() &&
    ob.businessSize &&
    rolesPicked &&
    goalsPicked &&
    ob.automationPreference &&
    businessContextPicked
  );
  const panelReady = [
    !!(ob.companyName.trim() && ob.industry.trim() && ob.region.trim() && ob.businessSize),
    !!(rolesPicked && goalsPicked),
    !!(ob.automationPreference && Object.values(ob.businessPlatforms).some(Boolean)),
    !!(
      Object.values(ob.communications).some(Boolean) ||
      Object.values(ob.marketingSales).some(Boolean) ||
      Object.values(ob.operationsAdmin).some(Boolean) ||
      Object.values(ob.documents).some(Boolean) ||
      ob.uploadedFiles.length > 0
    ),
  ];

  useEffect(() => {
    if (ob.step !== 1) return;
    if (!panelReady[snapshotPanel] || snapshotPanel >= panelReady.length - 1) return;
    if (autoAdvanceRef.current === snapshotPanel) return;
    const timer = setTimeout(() => {
      autoAdvanceRef.current = snapshotPanel;
      setSnapshotPanel((current) => (current === snapshotPanel ? Math.min(current + 1, panelReady.length - 1) : current));
    }, 450);
    return () => clearTimeout(timer);
  }, [ob.step, panelReady, snapshotPanel]);

  return (
    <div style={sx({ minHeight: "100vh", background: "linear-gradient(180deg, var(--paper) 0%, var(--paper2) 100%)", animation: "fadeUp .45s ease both" })}>
      <div style={sx({ borderBottom: "1px solid var(--line)", background: "var(--ink)", color: "var(--paper)", overflow: "hidden", whiteSpace: "nowrap" })}>
        <div style={sx({ display: "inline-flex", gap: 30, padding: "10px 0", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", animation: "marq 34s linear infinite" })}>
          <span>Business Discovery</span>
          <span>AI Business Consultant</span>
          <span>Outcome-focused onboarding</span>
          <span>Voice is optional</span>
          <span>Business Discovery</span>
          <span>AI Business Consultant</span>
          <span>Outcome-focused onboarding</span>
          <span>Voice is optional</span>
        </div>
      </div>

      <nav style={sx({ position: "sticky", top: 0, zIndex: 30, background: "rgba(244,238,227,.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--line)" })}>
        <div style={sx({ maxWidth: 1180, margin: "0 auto", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 })}>
          <div style={sx({ display: "flex", alignItems: "center", gap: 10 })}>
            <span style={sx({ width: 11, height: 11, borderRadius: "50%", background: "var(--ink)", display: "inline-block" })} />
            <span style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: 22, letterSpacing: "-.02em" })}>Margo</span>
          </div>
          <div style={sx({ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" })}>
            <span style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: ob.step === 1 ? "var(--ink)" : "var(--ink3)" })}>Step 1: Business Snapshot</span>
            <span style={sx({ width: 18, height: 1, background: "var(--line2)" })} />
            <span style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: ob.step === 2 ? "var(--ink)" : "var(--ink3)" })}>Step 2: Discovery Method</span>
          </div>
        </div>
      </nav>

      <main style={sx({ maxWidth: 1180, margin: "0 auto", padding: "44px 32px 80px" })}>
        <section style={sx({ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 26, alignItems: "start" })}>
          <div style={sx({ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 24, padding: "34px 30px", boxShadow: "0 30px 60px -42px rgba(26,23,18,.45)" })}>
            {ob.step === 1 && (
              <>
                <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ember)" })}>Step 1 - Business Snapshot</div>
                <h1 style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: "clamp(36px,5vw,62px)", lineHeight: 0.94, letterSpacing: "-.03em", margin: "14px 0 10px", maxWidth: "12ch" })}>Give us the shape of the business first.</h1>
                <p style={sx({ margin: 0, fontSize: 16.5, color: "var(--ink2)", lineHeight: 1.55, maxWidth: "50ch" })}>We use this snapshot to personalize discovery, avoid asking for information you already have, and recommend the right AI operating model for your team.</p>
                <div style={sx({ display: "grid", gap: 10, marginTop: 24 })}>
                  <div style={sx({ display: "flex", gap: 8 })}>
                    {["Basics", "Team", "Business", "Systems"].map((label, index) => (
                      <button
                        key={label}
                        onClick={() => setSnapshotPanel(index)}
                        style={sx({ flex: 1, border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" })}
                      >
                        <div style={sx({ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: index === snapshotPanel ? "var(--ink)" : panelReady[index] ? "var(--forest)" : "var(--ink3)", marginBottom: 6 })}>{label}</div>
                        <div style={sx({ height: 5, borderRadius: 999, background: index === snapshotPanel ? "var(--ink)" : panelReady[index] ? "var(--forest)" : "var(--line)" })} />
                      </button>
                    ))}
                  </div>
                  <div style={sx({ fontSize: 13, color: "var(--ink3)" })}>Answer a few questions at a time. We&apos;ll move you forward as each section is completed.</div>
                </div>

                <div style={sx({ marginTop: 24, overflow: "hidden" })}>
                  <div style={sx({ display: "flex", width: `${panelReady.length * 100}%`, transform: `translateX(-${snapshotPanel * (100 / panelReady.length)}%)`, transition: "transform .35s ease" })}>
                    <div style={sx({ width: `${100 / panelReady.length}%`, paddingRight: 20, flex: "none" })}>
                      <div style={sx({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 })}>
                        <label style={sx({ display: "flex", flexDirection: "column", gap: 7 })}>
                          <span style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)" })}>Company name</span>
                          <input value={ob.companyName} onChange={(e) => s.obSet("companyName", e.target.value)} placeholder="Acme Studio" style={sx({ border: "1px solid var(--line2)", background: "var(--paper)", borderRadius: 12, padding: "13px 14px", fontSize: 14.5, outline: "none" })} />
                        </label>
                        <label style={sx({ display: "flex", flexDirection: "column", gap: 7 })}>
                          <span style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)" })}>Industry</span>
                          <input value={ob.industry} onChange={(e) => s.obSet("industry", e.target.value)} placeholder="Retail, healthcare, logistics..." style={sx({ border: "1px solid var(--line2)", background: "var(--paper)", borderRadius: 12, padding: "13px 14px", fontSize: 14.5, outline: "none" })} />
                        </label>
                        <label style={sx({ display: "flex", flexDirection: "column", gap: 7 })}>
                          <span style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)" })}>Country or region</span>
                          <input value={ob.region} onChange={(e) => s.obSet("region", e.target.value)} placeholder="Singapore" style={sx({ border: "1px solid var(--line2)", background: "var(--paper)", borderRadius: 12, padding: "13px 14px", fontSize: 14.5, outline: "none" })} />
                        </label>
                        <div style={sx({ display: "flex", flexDirection: "column", gap: 7 })}>
                          <span style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)" })}>Business size</span>
                          <div style={sx({ display: "flex", flexWrap: "wrap", gap: 10 })}>
                            {sizeOptions.map((option) => {
                              const on = ob.businessSize === option;
                              return (
                                <button
                                  key={option}
                                  onClick={() => s.obSet("businessSize", option)}
                                  className="hv-tf"
                                  style={sx({ border: `1px solid ${on ? "var(--ink)" : "var(--line2)"}`, background: on ? "var(--ink)" : "var(--card)", color: on ? "var(--paper)" : "var(--ink)", borderRadius: 999, padding: "10px 14px", fontSize: 13.5, cursor: "pointer", transition: "transform .18s", "--hv-tf": "translateY(-2px)" })}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={sx({ width: `${100 / panelReady.length}%`, paddingRight: 20, flex: "none" })}>
                      <div style={sx({ display: "grid", gap: 24 })}>
                        <div>
                          <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>Which roles currently exist?</div>
                          <ChipGroup items={ob.teamRoles} builtInItems={["Sales", "Marketing", "Customer Support", "Operations", "Finance", "HR", "Other"]} onToggle={(key) => s.obToggle("teamRoles", key)} otherValue={ob.teamRolesOther} onOtherChange={(value) => s.obSet("teamRolesOther", value)} onOtherAdd={() => s.obAddCustomOption("teamRoles")} onCustomRename={(oldKey, nextKey) => s.obRenameCustomOption("teamRoles", oldKey, nextKey)} onCustomDelete={(key) => s.obDeleteCustomOption("teamRoles", key)} />
                        </div>
                        <div>
                          <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>What would you like to improve?</div>
                          <ChipGroup items={ob.goals} builtInItems={["Save time", "Reduce repetitive work", "Increase sales", "Improve customer support", "Improve operations", "Reduce costs", "Other"]} onToggle={(key) => s.obToggle("goals", key)} activeStyle="dark" otherValue={ob.goalsOther} onOtherChange={(value) => s.obSet("goalsOther", value)} onOtherAdd={() => s.obAddCustomOption("goals")} onCustomRename={(oldKey, nextKey) => s.obRenameCustomOption("goals", oldKey, nextKey)} onCustomDelete={(key) => s.obDeleteCustomOption("goals", key)} />
                        </div>
                      </div>
                    </div>

                    <div style={sx({ width: `${100 / panelReady.length}%`, paddingRight: 20, flex: "none" })}>
                      <div style={sx({ display: "grid", gap: 24 })}>
                        <div>
                          <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>How would you like AI to support your business?</div>
                          <div style={sx({ display: "grid", gap: 10 })}>
                            {automationOptions.map((option) => {
                              const on = ob.automationPreference === option;
                              return (
                                <button
                                  key={option}
                                  onClick={() => s.obSet("automationPreference", option)}
                                  className="hv-tf"
                                  style={sx({ textAlign: "left", border: `1px solid ${on ? "var(--forest)" : "var(--line2)"}`, background: on ? "rgba(54,104,74,.08)" : "var(--paper)", color: "var(--ink)", borderRadius: 14, padding: "13px 16px", fontSize: 14, cursor: "pointer", transition: "transform .18s", "--hv-tf": "translateY(-2px)" })}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>Where does your business mainly happen?</div>
                          <ChipGroup items={ob.businessPlatforms} builtInItems={["Online store / ecommerce", "Marketplace", "Physical store / POS", "Appointments / bookings", "Service business / projects", "Wholesale", "Manufacturing", "Hospitality", "Healthcare", "Education", "Logistics / field operations", "Membership / subscription", "Other"]} onToggle={(key) => s.obToggle("businessPlatforms", key)} otherValue={ob.businessPlatformsOther} onOtherChange={(value) => s.obSet("businessPlatformsOther", value)} onOtherAdd={() => s.obAddCustomOption("businessPlatforms")} onCustomRename={(oldKey, nextKey) => s.obRenameCustomOption("businessPlatforms", oldKey, nextKey)} onCustomDelete={(key) => s.obDeleteCustomOption("businessPlatforms", key)} />
                        </div>
                      </div>
                    </div>

                    <div style={sx({ width: `${100 / panelReady.length}%`, paddingRight: 20, flex: "none" })}>
                      <div style={sx({ display: "grid", gap: 24 })}>
                        <div style={sx({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 })}>
                          <div>
                            <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>Communications</div>
                            <ChipGroup items={ob.communications} builtInItems={["Email", "Phone", "WhatsApp", "Slack / Teams", "Website chat", "Social DMs", "Other"]} onToggle={(key) => s.obToggle("communications", key)} otherValue={ob.communicationsOther} onOtherChange={(value) => s.obSet("communicationsOther", value)} onOtherAdd={() => s.obAddCustomOption("communications")} onCustomRename={(oldKey, nextKey) => s.obRenameCustomOption("communications", oldKey, nextKey)} onCustomDelete={(key) => s.obDeleteCustomOption("communications", key)} />
                          </div>
                          <div>
                            <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>Marketing and sales</div>
                            <ChipGroup items={ob.marketingSales} builtInItems={["CRM", "Email marketing", "Paid ads", "Social scheduling", "Lead forms", "Sales pipeline", "Other"]} onToggle={(key) => s.obToggle("marketingSales", key)} otherValue={ob.marketingSalesOther} onOtherChange={(value) => s.obSet("marketingSalesOther", value)} onOtherAdd={() => s.obAddCustomOption("marketingSales")} onCustomRename={(oldKey, nextKey) => s.obRenameCustomOption("marketingSales", oldKey, nextKey)} onCustomDelete={(key) => s.obDeleteCustomOption("marketingSales", key)} />
                          </div>
                        </div>
                        <div>
                          <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>Operations and admin</div>
                          <ChipGroup items={ob.operationsAdmin} builtInItems={["Accounting", "Inventory", "Project management", "Customer support desk", "File storage / docs", "HR", "Other"]} onToggle={(key) => s.obToggle("operationsAdmin", key)} otherValue={ob.operationsAdminOther} onOtherChange={(value) => s.obSet("operationsAdminOther", value)} onOtherAdd={() => s.obAddCustomOption("operationsAdmin")} onCustomRename={(oldKey, nextKey) => s.obRenameCustomOption("operationsAdmin", oldKey, nextKey)} onCustomDelete={(key) => s.obDeleteCustomOption("operationsAdmin", key)} />
                        </div>
                        <div>
                          <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 })}>Existing business information (optional)</div>
                          <ChipGroup items={ob.documents} builtInItems={["Lean Canvas", "SOPs", "Organisation Chart", "Process Documentation", "Employee Handbook", "Other", "Upload"]} onToggle={(key) => s.obToggle("documents", key)} otherValue={ob.documentsOther} onOtherChange={(value) => s.obSet("documentsOther", value)} onOtherAdd={() => s.obAddCustomOption("documents")} onCustomRename={(oldKey, nextKey) => s.obRenameCustomOption("documents", oldKey, nextKey)} onCustomDelete={(key) => s.obDeleteCustomOption("documents", key)} />
                          <label style={sx({ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 12, border: "1px dashed var(--line2)", background: "var(--paper)", borderRadius: 12, padding: "11px 14px", cursor: "pointer", width: "fit-content" })}>
                            <span style={sx({ fontSize: 14, fontWeight: 600, color: "var(--ink)" })}>Upload files</span>
                            <span style={sx({ fontSize: 12.5, color: "var(--ink3)" })}>{ob.uploadedFiles.length ? `${ob.uploadedFiles.length} selected` : "Optional"}</span>
                            <input
                              type="file"
                              multiple
                              onChange={(e) => s.obUpload(Array.from(e.target.files ?? []).map((file) => file.name))}
                              style={{ display: "none" }}
                            />
                          </label>
                          {ob.uploadedFiles.length > 0 && (
                            <div style={sx({ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 })}>
                              {ob.uploadedFiles.map((file) => (
                                <span key={file} style={sx({ border: "1px solid var(--line2)", background: "var(--card)", borderRadius: 999, padding: "7px 11px", fontSize: 12.5, color: "var(--ink2)" })}>{file}</span>
                              ))}
                            </div>
                          )}
                          <p style={sx({ fontSize: 13.5, color: "var(--ink3)", lineHeight: 1.5, margin: "12px 0 0" })}>We&apos;ll analyze these before continuing so we can ask more relevant questions and avoid asking for information you&apos;ve already provided.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={sx({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" })}>
                  <button
                    onClick={snapshotPanel > 0 ? () => setSnapshotPanel((current) => Math.max(0, current - 1)) : undefined}
                    style={sx(snapshotPanel > 0
                      ? { background: "transparent", color: "var(--ink2)", border: "1px solid var(--line2)", borderRadius: 999, padding: "13px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }
                      : { background: "transparent", color: "var(--ink3)", border: "1px solid var(--line)", borderRadius: 999, padding: "13px 18px", fontSize: 13.5, fontWeight: 600, cursor: "default", opacity: 0.5 })}
                  >
                    Back
                  </button>
                  <div style={sx({ textAlign: "center" })}>
                    <div style={sx({ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 20 })}>{snapshotPanel < panelReady.length - 1 ? "A few questions at a time." : "Your Business Snapshot is getting ready."}</div>
                    <div style={sx({ fontSize: 14, color: "var(--ink2)", marginTop: 4 })}>
                      {snapshotPanel < panelReady.length - 1
                        ? (panelReady[snapshotPanel] ? "Looks good. We’ll move you along automatically, or you can continue now." : "Answer this section and we’ll bring up the next one.")
                        : "Next, we’ll learn how your business actually operates so we can recommend the most valuable AI opportunities."}
                    </div>
                  </div>
                  {snapshotPanel < panelReady.length - 1 ? (
                    <button
                      onClick={panelReady[snapshotPanel] ? () => setSnapshotPanel((current) => Math.min(panelReady.length - 1, current + 1)) : undefined}
                      className={panelReady[snapshotPanel] ? "hv-bg" : undefined}
                      style={sx(
                        panelReady[snapshotPanel]
                          ? { background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 999, padding: "15px 24px", fontSize: 14.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", "--hv-bg": "var(--ember)" }
                          : { background: "var(--paper3)", color: "var(--ink3)", border: "none", borderRadius: 999, padding: "15px 24px", fontSize: 14.5, fontWeight: 600, cursor: "default", whiteSpace: "nowrap" },
                      )}
                    >
                      Next section →
                    </button>
                  ) : (
                    <button
                      onClick={snapshotReady ? s.obNext : undefined}
                      className={snapshotReady ? "hv-bg" : undefined}
                      style={sx(
                        snapshotReady
                          ? { background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 999, padding: "15px 24px", fontSize: 14.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", "--hv-bg": "var(--ember)" }
                          : { background: "var(--paper3)", color: "var(--ink3)", border: "none", borderRadius: 999, padding: "15px 24px", fontSize: 14.5, fontWeight: 600, cursor: "default", whiteSpace: "nowrap" },
                      )}
                    >
                      Continue to discovery {"->"}
                    </button>
                  )}
                </div>
              </>
            )}

            {ob.step === 2 && (
              <>
                <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ember)" })}>Step 2 - Business Discovery</div>
                <h1 style={sx({ fontFamily: "var(--disp)", fontWeight: 800, fontSize: "clamp(34px,4.8vw,58px)", lineHeight: 0.95, letterSpacing: "-.03em", margin: "14px 0 10px", maxWidth: "13ch" })}>Choose how you&apos;d like to walk us through the business.</h1>
                <p style={sx({ margin: 0, fontSize: 16.5, color: "var(--ink2)", lineHeight: 1.55, maxWidth: "48ch" })}>Start one guided discovery session. If you want to talk, use your microphone. If you prefer typing, the same chat interface is already there.</p>

                <div style={sx({ marginTop: 30, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 22, padding: "26px 24px" })}>
                  <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--forest)" })}>Discovery Session</div>
                  <h2 style={sx({ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 28, letterSpacing: "-.02em", margin: "10px 0 8px" })}>{discoveryOptions[0].title}</h2>
                  <p style={sx({ margin: 0, fontSize: 15, color: "var(--ink2)", lineHeight: 1.55, maxWidth: "42ch" })}>{discoveryOptions[0].body}</p>
                  <button
                    onClick={() => s.startDiscovery("voice")}
                    className="hv-bg"
                    style={sx({ marginTop: 22, background: "var(--ink)", color: "var(--paper)", border: "none", borderRadius: 999, padding: "13px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", "--hv-bg": "var(--ember)" })}
                  >
                    {discoveryOptions[0].cta}
                  </button>
                </div>

                <div style={sx({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 28 })}>
                  <button onClick={s.obBack} style={sx({ background: "transparent", color: "var(--ink2)", border: "1px solid var(--line2)", borderRadius: 999, padding: "13px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" })}>Back to snapshot</button>
                  <div style={sx({ fontSize: 13.5, color: "var(--ink3)" })}>You can switch between speaking and typing during the session.</div>
                </div>
              </>
            )}
          </div>

          <aside style={sx({ display: "grid", gap: 18 })}>
            <div style={sx({ background: "var(--ink)", color: "var(--paper)", borderRadius: 24, padding: "26px 24px" })}>
              <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.65 })}>How this works</div>
              <div style={sx({ display: "grid", gap: 14, marginTop: 18 })}>
                {[
                  "We analyze your snapshot before discovery continues.",
                  "The AI asks follow-up questions based on your business, team, and goals.",
                  "You review and approve the business blueprint before planning starts.",
                  "Only approved information moves into workflow and agent planning.",
                ].map((item, index) => (
                  <div key={item} style={sx({ display: "grid", gridTemplateColumns: "26px 1fr", gap: 10, alignItems: "start" })}>
                    <span style={sx({ width: 26, height: 26, borderRadius: "50%", background: "rgba(244,238,227,.12)", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 10 })}>{String(index + 1).padStart(2, "0")}</span>
                    <span style={sx({ fontSize: 14, lineHeight: 1.5, opacity: 0.86 })}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {ob.step === 2 && (
              <div style={sx({ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 22, padding: "24px 22px" })}>
                <div style={sx({ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)" })}>Snapshot preview</div>
                <div style={sx({ marginTop: 16, display: "grid", gap: 12 })}>
                  {[
                    ["Company", ob.companyName || "Not added yet"],
                    ["Industry", ob.industry || "Not added yet"],
                    ["Region", ob.region || "Not added yet"],
                    ["Size", ob.businessSize || "Not selected yet"],
                    ["Roles", Object.keys(ob.teamRoles).filter((k) => ob.teamRoles[k] && k !== "Other").join(", ") || "No roles selected yet"],
                    ["Goals", [...Object.keys(ob.goals).filter((k) => ob.goals[k] && k !== "Other"), ...(ob.goals.Other && ob.goalsOther.trim() ? [`Other: ${ob.goalsOther.trim()}`] : [])].join(", ") || "No goals selected yet"],
                    ["AI support", ob.automationPreference || "Not chosen yet"],
                    ["Business context", [
                      ...Object.keys(ob.businessPlatforms).filter((k) => ob.businessPlatforms[k] && k !== "Other"),
                      ...Object.keys(ob.communications).filter((k) => ob.communications[k] && k !== "Other"),
                      ...Object.keys(ob.marketingSales).filter((k) => ob.marketingSales[k] && k !== "Other"),
                      ...Object.keys(ob.operationsAdmin).filter((k) => ob.operationsAdmin[k] && k !== "Other"),
                    ].join(", ") || "No business context selected yet"],
                  ].map(([label, value]) => (
                    <div key={label} style={sx({ borderBottom: "1px solid var(--line)", paddingBottom: 10 })}>
                      <div style={sx({ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink3)" })}>{label}</div>
                      <div style={sx({ fontSize: 14.5, color: "var(--ink)", lineHeight: 1.45, marginTop: 4 })}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
