"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRightCircle, Building2, Check, SearchCode, Send, ShieldCheck, Users } from "lucide-react";
import type {
  AutomationScope,
  DepartmentApproval,
  OrganizationShape,
  WorkflowBuilder,
} from "@/lib/mock/types";
import { DEMO_COMPANY, TOOL_CATALOG } from "@/lib/mock/fixtures/demo-company";
import { DUR, EASE } from "@/lib/mock/motion";
import styles from "./onboarding.module.css";

const TEAM_OPTIONS: Array<{
  id: OrganizationShape;
  title: string;
  body: string;
  icon: typeof Building2;
}> = [
  {
    id: "solo",
    title: "Just me",
    body: "Keep the setup tight and move quickly.",
    icon: Building2,
  },
  {
    id: "owner_with_team",
    title: "Me and my team",
    body: "Start with the right people involved when needed.",
    icon: Users,
  },
];

const BUILDER_OPTIONS: Array<{
  id: WorkflowBuilder;
  title: string;
  body: string;
}> = [
  {
    id: "self",
    title: "I'll build it myself",
    body: "You stay hands-on for the first setup.",
  },
  {
    id: "invite",
    title: "I want someone else to build it",
    body: "Invite a teammate or operator to handle setup.",
  },
];

const SCOPE_OPTIONS: Array<{
  id: AutomationScope;
  title: string;
  body: string;
  support: string;
  icon: typeof ArrowRightCircle;
}> = [
  {
    id: "start_small",
    title: "Start with one task",
    body: "Pick one repetitive task and prove value quickly.",
    support: "Best for a fast first win.",
    icon: ArrowRightCircle,
  },
  {
    id: "focus_area",
    title: "Improve one business area",
    body: "Focus on one area like ops, sales, or finance.",
    support: "Best if you know where the pressure is.",
    icon: SearchCode,
  },
  {
    id: "whole_business",
    title: "Analyse the whole business",
    body: "Review multiple areas and build a broader plan.",
    support: "Best for analysing the whole business and finding what to automate first.",
    icon: Users,
  },
];

const TOOL_NAME = new Map(TOOL_CATALOG.map((tool) => [tool.id, tool.name]));
const DEPARTMENT_OPTIONS = ["Finance", "Admin", "Marketing", "Operations", "Sales", "Customer Support", "Other"];

type DepartmentRow = { department: string; customDepartment: string; email: string };
type ApprovalRoute = "person" | "department";

export default function ModeStep({
  organizationShape,
  workflowBuilder,
  automationScope,
  employeeCount,
  employeeEmails,
  approvalOwner,
  departmentApprovals,
  usedDemo,
  selectedToolIds,
  onOrganizationShapeChange,
  onWorkflowBuilderChange,
  onAutomationScopeChange,
  onEmployeeCountChange,
  onEmployeeEmailsChange,
  onApprovalOwnerChange,
  onDepartmentApprovalsChange,
  onUseDemo,
}: {
  organizationShape: OrganizationShape;
  workflowBuilder: WorkflowBuilder | null;
  automationScope: AutomationScope | null;
  employeeCount: string;
  employeeEmails: string[];
  approvalOwner: string;
  departmentApprovals: DepartmentApproval[];
  usedDemo: boolean;
  selectedToolIds: string[];
  onOrganizationShapeChange: (shape: OrganizationShape) => void;
  onWorkflowBuilderChange: (builder: WorkflowBuilder) => void;
  onAutomationScopeChange: (scope: AutomationScope) => void;
  onEmployeeCountChange: (count: string) => void;
  onEmployeeEmailsChange: (emails: string[]) => void;
  onApprovalOwnerChange: (owner: string) => void;
  onDepartmentApprovalsChange: (items: DepartmentApproval[]) => void;
  onUseDemo: () => void;
}) {
  const reduced = useReducedMotion();
  const [approvalRoute, setApprovalRoute] = useState<ApprovalRoute>(() =>
    departmentApprovals.length ? "department" : "person",
  );
  const [departmentRows, setDepartmentRows] = useState<DepartmentRow[]>(() =>
    departmentApprovals.length
      ? departmentApprovals.map((item) => ({
          department: DEPARTMENT_OPTIONS.includes(item.department) ? item.department : "Other",
          customDepartment: DEPARTMENT_OPTIONS.includes(item.department) ? "" : item.department,
          email: item.email || item.approver || "",
        }))
      : [{ department: "", customDepartment: "", email: "" }],
  );
  const toolNames = selectedToolIds
    .map((id) => TOOL_NAME.get(id))
    .filter((name): name is string => Boolean(name));

  useEffect(() => {
    const persistedRows = departmentApprovals.map((item) => ({
      department: DEPARTMENT_OPTIONS.includes(item.department) ? item.department : "Other",
      customDepartment: DEPARTMENT_OPTIONS.includes(item.department) ? "" : item.department,
      email: item.email || item.approver || "",
    }));
    const completedLocalRows = departmentRows
      .filter((row) => (row.department === "Other" ? row.customDepartment : row.department) && row.email)
      .map((row) => ({ ...row }));
    if (JSON.stringify(persistedRows) !== JSON.stringify(completedLocalRows)) {
      setDepartmentRows(persistedRows.length ? persistedRows : [{ department: "", customDepartment: "", email: "" }]);
    }
  }, [departmentApprovals]);

  useEffect(() => {
    if (organizationShape === "solo") setApprovalRoute("person");
  }, [organizationShape]);

  const updateDepartmentRows = (rows: DepartmentRow[]) => {
    setDepartmentRows(rows);
    onDepartmentApprovalsChange(
      rows
        .filter((row) => (row.department === "Other" ? row.customDepartment : row.department) && row.email)
        .map((row) => ({
          department: row.department === "Other" ? row.customDepartment : row.department,
          email: row.email,
          approver: row.email,
          processOwner: "",
          setupDelegate: row.email,
          discoveryStatus: "invited" as const,
        })),
    );
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h2 className="oa-h3">Set up your discovery</h2>
        <p className="oa-sub">
          A few quick choices first, then we&apos;ll narrow into the workflow you want to improve.
        </p>
      </div>

      <div className={styles.setupPanel}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <label className="oa-label">Is it just you, or are you setting this up with a team?</label>
          </div>
          <div className={styles.setupGridTwo}>
            {TEAM_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = option.id === "solo" ? organizationShape === "solo" : organizationShape !== "solo";
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`oa-selectable ${styles.setupCard} ${selected ? "oa-selectable--selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onOrganizationShapeChange(option.id)}
                >
                  <span className={styles.modeBody}>
                    <span className={styles.modeTop}>
                      <span className={styles.modeIcon}>
                        <Icon size={17} aria-hidden />
                      </span>
                      <span className="oa-radio" aria-hidden />
                    </span>
                    <span className={styles.modeText}>
                      <span className={styles.modeTitle}>{option.title}</span>
                      <span className="oa-sub">{option.body}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <label className="oa-label">Who&apos;s going to build your first workflow?</label>
          </div>
          <div className={styles.setupGridTwo}>
            {BUILDER_OPTIONS.map((option) => {
              const selected = workflowBuilder === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`oa-selectable ${styles.setupCard} ${selected ? "oa-selectable--selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onWorkflowBuilderChange(option.id)}
                >
                  <span className={styles.modeBody}>
                    <span className={styles.modeTop}>
                      <span className={styles.modeMiniLabel}>Workflow owner</span>
                      <span className="oa-radio" aria-hidden />
                    </span>
                    <span className={styles.modeText}>
                      <span className={styles.modeTitle}>{option.title}</span>
                      <span className="oa-sub">{option.body}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {organizationShape !== "solo" && (
          <div className={styles.setupInfoCard}>
            <div style={{ display: "grid", gap: 4 }}>
              <label className="oa-label" htmlFor="employee-count">Tell us about your team</label>
              <p className="oa-sub" style={{ margin: 0 }}>
                Add this now or leave it blank and come back later.
              </p>
            </div>
            <div className={styles.teamFields}>
              <label className="oa-field">
                <span className="oa-label">How many people are involved?</span>
                <input
                  id="employee-count"
                  className="oa-input"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="e.g. 8"
                  value={employeeCount}
                  onChange={(event) => onEmployeeCountChange(event.target.value)}
                />
              </label>
              <label className="oa-field">
                <span className="oa-label">Who should Oriant be able to involve?</span>
                <textarea
                  className="oa-input"
                  rows={3}
                  placeholder="Add work emails, one per line"
                  value={employeeEmails.join("\n")}
                  onChange={(event) => onEmployeeEmailsChange(
                    event.target.value
                      .split(/[\n,;]+/)
                      .map((email) => email.trim())
                      .filter(Boolean),
                  )}
                />
              </label>
            </div>
          </div>
        )}

        {workflowBuilder === "invite" && (
          <div className={styles.setupInfoCard}>
            <div style={{ display: "grid", gap: 4 }}>
              <label className="oa-label" htmlFor="workflow-builder-contact">Who should build the first workflow?</label>
              <p className="oa-sub" style={{ margin: 0 }}>
                Add their email and they&apos;ll be invited to this setup.
              </p>
            </div>
            <input
              id="workflow-builder-contact"
              className="oa-input"
              type="text"
              placeholder="e.g. alex@company.com or Alex Tan"
              value={employeeEmails[0] ?? ""}
              onChange={(event) => {
                const contact = event.target.value.trim();
                const remaining = employeeEmails.slice(1);
                onEmployeeEmailsChange(contact ? [contact, ...remaining] : remaining);
              }}
            />
          </div>
        )}

        <div className={styles.setupInfoCard}>
          <div style={{ display: "grid", gap: 4 }}>
            <span className="oa-label">Who should handle approvals?</span>
            <p className="oa-sub" style={{ margin: 0 }}>
              This is the person or team Oriant should ask before sensitive actions.
            </p>
          </div>
          <div className={styles.setupGridTwo}>
            {(["person", "department"] as ApprovalRoute[]).map((route) => (
              <button
                key={route}
                type="button"
                className={`oa-selectable ${styles.setupCard} ${approvalRoute === route ? "oa-selectable--selected" : ""}`}
                aria-pressed={approvalRoute === route}
                disabled={organizationShape === "solo" && route === "department"}
                onClick={() => {
                  setApprovalRoute(route);
                  if (route === "person") onDepartmentApprovalsChange([]);
                  else if (organizationShape !== "solo") onApprovalOwnerChange("");
                }}
              >
                <span className={styles.modeBody}>
                  <span className={styles.modeTop}><span className="oa-radio" aria-hidden /></span>
                  <span className={styles.modeText}>
                    <span className={styles.modeTitle}>{route === "person" ? "A person" : "A department"}</span>
                    <span className="oa-sub">{route === "person" ? "One owner approves sensitive actions." : "Each department can have its own approver."}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          {approvalRoute === "person" && (
            <label className="oa-field" htmlFor="approval-owner">
              <span className="oa-label">Approver</span>
              <input
                id="approval-owner"
                className="oa-input"
                type="text"
                value={organizationShape === "solo" ? "You" : approvalOwner}
                placeholder="Name or work email"
                disabled={organizationShape === "solo"}
                onChange={(event) => onApprovalOwnerChange(event.target.value)}
              />
              {organizationShape === "solo" && (
                <span className="oa-sim-note">For a solo setup, approvals stay with you.</span>
              )}
            </label>
          )}
          {approvalRoute === "department" && organizationShape !== "solo" && (
            <label className="oa-field">
              <span className="oa-label">Department approval routing</span>
              <div className={styles.approvalRows}>
                <div className={styles.approvalRowHeader}>
                  <span>Department</span>
                  <span>Email address</span>
                  <span aria-hidden />
                </div>
                {departmentRows.map((row, index) => (
                  <div className={styles.approvalRow} key={`${index}-${row.department}-${row.customDepartment}`}>
                    <div className={styles.departmentCell}>
                      <select
                        className="oa-input"
                        aria-label={`Department ${index + 1}`}
                        value={row.department}
                        onChange={(event) => {
                          const next = [...departmentRows];
                          next[index] = { ...row, department: event.target.value, customDepartment: "" };
                          updateDepartmentRows(next);
                        }}
                      >
                        <option value="" disabled hidden>Choose a department</option>
                        {DEPARTMENT_OPTIONS.map((department) => <option key={department} value={department}>{department}</option>)}
                      </select>
                      {row.department === "Other" && (
                        <input
                          className="oa-input"
                          type="text"
                          aria-label={`Custom department ${index + 1}`}
                          placeholder="Enter department name"
                          value={row.customDepartment}
                          onChange={(event) => {
                            const next = [...departmentRows];
                            next[index] = { ...row, customDepartment: event.target.value };
                            updateDepartmentRows(next);
                          }}
                        />
                      )}
                    </div>
                    <input
                      className="oa-input"
                      type="email"
                      aria-label={`Approval email ${index + 1}`}
                      placeholder="name@company.com"
                      value={row.email}
                      onChange={(event) => {
                        const next = [...departmentRows];
                        next[index] = { ...row, email: event.target.value };
                        updateDepartmentRows(next);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.removeRow}
                      aria-label={`Remove department ${index + 1}`}
                      onClick={() => updateDepartmentRows(departmentRows.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="oa-btn oa-btn--ghost"
                  onClick={() => setDepartmentRows([...departmentRows, { department: "", customDepartment: "", email: "" }])}
                >
                  + Add department
                </button>
              </div>
            </label>
          )}
        </div>
      </div>

      <div className={styles.setupPanel}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <label className="oa-label">How do you want to start?</label>
            <p className="oa-sub" style={{ margin: 0 }}>
              This controls how focused the onboarding stays.
            </p>
          </div>
          <div className={styles.setupGrid}>
            {SCOPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = automationScope === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`oa-selectable ${styles.setupCard} ${selected ? "oa-selectable--selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onAutomationScopeChange(option.id)}
                >
                  <span className={styles.modeBody}>
                    <span className={styles.modeTop}>
                      <span className={styles.modeIcon}>
                        <Icon size={17} aria-hidden />
                      </span>
                      <span className="oa-radio" aria-hidden />
                    </span>
                    <span className={styles.modeText}>
                      <span className={styles.modeTitle}>{option.title}</span>
                      <span className="oa-sub">{option.body}</span>
                    </span>
                    <span className={styles.modeRec}>{option.support}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <span className="oa-sim-note">
            You can always start small and expand later.
          </span>
        </div>
      </div>

      <div className={styles.demoPanel} data-demo-label>
        <div>
          <span className="oa-micro">Shortcut</span>
          <h3 className="oa-h3">Try it with a ready-made company</h3>
          <p className="oa-sub">
            {DEMO_COMPANY.name}: {DEMO_COMPANY.teamSize} people in{" "}
            {DEMO_COMPANY.location}, already scoped around one workflow.
          </p>
        </div>
        <button
          type="button"
          className="oa-btn oa-btn--soft"
          onClick={onUseDemo}
          disabled={usedDemo}
        >
          {usedDemo ? <Check size={15} aria-hidden /> : <Send size={15} aria-hidden />}
          {usedDemo ? "Demo company loaded" : "Use demo company"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {usedDemo && (
          <motion.div
            key="demo-confirm"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.card, ease: EASE }}
            style={{ display: "grid", gap: 8 }}
          >
            <ul className={styles.demoList} aria-live="polite">
              <li>
                <Check size={14} aria-hidden />
                <span>Automation scope is set to improving one business area first.</span>
              </li>
              <li>
                <Check size={14} aria-hidden />
                <span>The business introduction, biggest time drain, and current workflow are drafted in the next steps.</span>
              </li>
              <li>
                <Check size={14} aria-hidden />
                <span>
                  {toolNames.length} tools selected: {toolNames.slice(0, 3).join(", ")}
                  {toolNames.length > 3 ? " and more" : ""}.
                </span>
              </li>
            </ul>
            <span className="oa-sim-note">
              Prepared demo profile. Nothing is imported from real accounts.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
