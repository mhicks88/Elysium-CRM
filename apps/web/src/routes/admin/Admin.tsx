// apps/web/src/routes/admin/Admin.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import {
  apiFetch,
  getComplianceSummary,
  getComplianceStatsByAgent,
  uploadLeadImportCsv,
  getRecentLeadImports,
  getUsersAdmin,
  updateUserAdmin,
  getCallScripts,
  getCallScriptById,
  type LeadCsvImportSummary,
  type LeadImportJobSummary,
  type AdminUserDto,
  type CallScript,
} from "../../lib/apiClient";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "DIRECTOR"
  | "COMPLIANCE_OFFICER";

interface RequireRoleProps {
  roles: Role[];
  children: React.ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user } = useAuth() as { user: any | null };

  if (!user) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Not authenticated</h1>
        <p>Please log in as an authorized user to view this page.</p>
      </div>
    );
  }

  const userRole = user.role as Role | undefined;

  if (!userRole || !roles.includes(userRole)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Access denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}

interface SummaryState {
  totalChecks: number;
  passCount: number;
  failCount: number;
  failRate: number;
  purposes: Record<
    string,
    { total: number; pass: number; fail: number }
  >;
  firstCheckAt: string | null;
  lastCheckAt: string | null;
}

interface AgentStat {
  userId: string;
  total: number;
  pass: number;
  fail: number;
}

interface FailureRow {
  id: string;
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL";
  result: any;
  createdAt: string;
}

type AdminTab = "COMPLIANCE" | "USERS" | "SCRIPTS";

const ROLE_OPTIONS: AdminUserDto["role"][] = [
  "ADMIN",
  "MANAGER",
  "DIRECTOR",
  "AGENT",
  "COMPLIANCE",
  "READ_ONLY",
];

const Admin: React.FC = () => {
  const { user: authUser } = useAuth() as { user: any | null };
  const isAdmin = authUser?.role === "ADMIN";

  const [activeTab, setActiveTab] =
    useState<AdminTab>("COMPLIANCE");

  // === Compliance tab state ===
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("");

  // Date filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Lead import (CSV) state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSource, setImportSource] = useState<string>("");
  const [importLoading, setImportLoading] =
    useState<boolean>(false);
  const [importError, setImportError] =
    useState<string | null>(null);
  const [importResult, setImportResult] =
    useState<LeadCsvImportSummary | null>(null);

  // Recent import jobs
  const [recentImports, setRecentImports] = useState<
    LeadImportJobSummary[]
  >([]);
  const [recentImportsError, setRecentImportsError] =
    useState<string | null>(null);

  // === Users tab state (ADMIN-only) ===
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] =
    useState<string | null>(null);
  const [editingUserId, setEditingUserId] =
    useState<string | null>(null);
  const [editDraft, setEditDraft] =
    useState<AdminUserDto | null>(null);
  const [savingUserId, setSavingUserId] =
    useState<string | null>(null);

  // === Scripts tab state ===
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptsError, setScriptsError] =
    useState<string | null>(null);
  const [selectedScriptId, setSelectedScriptId] =
    useState<string | null>(null);
  const [selectedScript, setSelectedScript] =
    useState<CallScript | null>(null);
  const [scriptDetailLoading, setScriptDetailLoading] =
    useState(false);
  const [scriptDetailError, setScriptDetailError] =
    useState<string | null>(null);

  // === Compliance tab logic ===

  async function loadComplianceData() {
    setLoading(true);
    setError(null);
    setRecentImportsError(null);
    try {
      const params =
        fromDate || toDate
          ? {
              from: fromDate || undefined,
              to: toDate || undefined,
            }
          : undefined;

      const [summaryRes, agentRes, failuresRes, importsRes] =
        await Promise.all([
          getComplianceSummary(params),
          getComplianceStatsByAgent(params),
          fetchRecentFailuresWithFilters(20, params),
          getRecentLeadImports(10),
        ]);

      setSummary(summaryRes);
      setAgentStats(agentRes.agents || []);
      setFailures(failuresRes.failures || []);
      setRecentImports(importsRes.jobs || []);
    } catch (err: any) {
      const msg =
        err?.message || "Failed to load admin dashboard data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await loadComplianceData();
      } catch {
        // error already handled
      }
      if (!mounted) return;
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAgents = agentStats.filter((agent) => {
    if (!agentFilter.trim()) return true;
    const term = agentFilter.toLowerCase();
    return agent.userId.toLowerCase().includes(term);
  });

  const failureRatePercent = summary ? summary.failRate * 100 : 0;
  const failureRateBadgeVariant =
    failureRatePercent >= 15
      ? "danger"
      : failureRatePercent >= 5
      ? "warning"
      : "success";

  async function handleRunImport(e: React.FormEvent) {
    e.preventDefault();
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    try {
      if (!importFile) {
        throw new Error("Please choose a CSV file to import.");
      }

      const result = await uploadLeadImportCsv(importFile, {
        source: importSource || undefined,
      });

      setImportResult(result);

      try {
        const importsRes = await getRecentLeadImports(10);
        setRecentImports(importsRes.jobs || []);
      } catch (err: any) {
        setRecentImportsError(
          err?.message ||
            "Imported, but failed to refresh recent imports"
        );
      }
    } catch (err: any) {
      setImportError(err?.message ?? "Failed to run lead import");
    } finally {
      setImportLoading(false);
    }
  }

  // === Users tab logic (ADMIN-only) ===

  async function loadUsers() {
    if (!isAdmin) return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await getUsersAdmin();
      setUsers(res.users || []);
    } catch (err: any) {
      setUsersError(err?.message ?? "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab !== "USERS") return;
    void loadUsers();
  }, [activeTab, isAdmin]);

  function startEditingUser(user: AdminUserDto) {
    setEditingUserId(user.id);
    setEditDraft({ ...user });
  }

  function cancelEditingUser() {
    setEditingUserId(null);
    setEditDraft(null);
  }

  function updateDraft<K extends keyof AdminUserDto>(
    key: K,
    value: AdminUserDto[K]
  ) {
    setEditDraft((prev) =>
      prev ? { ...prev, [key]: value } : prev
    );
  }

  async function saveUserEdits() {
    if (!editDraft || !editingUserId) return;
    setSavingUserId(editingUserId);
    setUsersError(null);

    try {
      const payload: any = {};
      if (editDraft.role) payload.role = editDraft.role;
      payload.managerId =
        editDraft.managerId && editDraft.managerId.trim().length > 0
          ? editDraft.managerId.trim()
          : null;
      payload.directorId =
        editDraft.directorId &&
        editDraft.directorId.trim().length > 0
          ? editDraft.directorId.trim()
          : null;
      payload.isActive = editDraft.isActive;

      const updated = await updateUserAdmin(editingUserId, payload);

      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      setEditingUserId(null);
      setEditDraft(null);
    } catch (err: any) {
      setUsersError(
        err?.message ?? "Failed to update user settings"
      );
    } finally {
      setSavingUserId(null);
    }
  }

  // === Scripts tab logic ===

  async function loadScripts() {
    setScriptsLoading(true);
    setScriptsError(null);
    setScriptDetailError(null);
    try {
      const res = await getCallScripts();
      const list = res.scripts || [];
      setScripts(list);

      if (!selectedScriptId && list.length > 0) {
        setSelectedScriptId(list[0].id);
      }
    } catch (err: any) {
      setScriptsError(err?.message ?? "Failed to load scripts");
    } finally {
      setScriptsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "SCRIPTS") return;
    if (scripts.length === 0 && !scriptsLoading) {
      void loadScripts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadScriptDetail(id: string) {
    setScriptDetailLoading(true);
    setScriptDetailError(null);
    try {
      const res = await getCallScriptById(id);
      setSelectedScript(res.script);
    } catch (err: any) {
      setScriptDetailError(
        err?.message ?? "Failed to load script details"
      );
    } finally {
      setScriptDetailLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "SCRIPTS") return;
    if (!selectedScriptId) return;
    void loadScriptDetail(selectedScriptId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScriptId, activeTab]);

  return (
    <RequireRole
      roles={["ADMIN", "MANAGER", "DIRECTOR", "COMPLIANCE_OFFICER"]}
    >
      <AppShell>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Page header + tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <h1
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                Admin workspace
              </h1>
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-soft)",
                  maxWidth: "40rem",
                }}
              >
                Compliance analytics, lead imports, org hierarchy, and
                interactive call scripts. Use this area to monitor risk
                and keep configuration aligned with reporting.
              </p>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "inline-flex",
                padding: "0.25rem",
                borderRadius: "999px",
                border: "1px solid var(--color-border-subtle)",
                backgroundColor: "rgba(15,23,42,0.7)",
                gap: "0.25rem",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("COMPLIANCE")}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "0.3rem 0.8rem",
                  fontSize: "var(--text-xs)",
                  cursor: "pointer",
                  backgroundColor:
                    activeTab === "COMPLIANCE"
                      ? "rgba(37,99,235,0.9)"
                      : "transparent",
                  color:
                    activeTab === "COMPLIANCE"
                      ? "var(--color-text-on-accent)"
                      : "var(--color-text-soft)",
                }}
              >
                Compliance & imports
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("USERS")}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "0.3rem 0.8rem",
                  fontSize: "var(--text-xs)",
                  cursor: "pointer",
                  backgroundColor:
                    activeTab === "USERS"
                      ? "rgba(37,99,235,0.9)"
                      : "transparent",
                  color:
                    activeTab === "USERS"
                      ? "var(--color-text-on-accent)"
                      : "var(--color-text-soft)",
                }}
              >
                Users & hierarchy
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("SCRIPTS")}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "0.3rem 0.8rem",
                  fontSize: "var(--text-xs)",
                  cursor: "pointer",
                  backgroundColor:
                    activeTab === "SCRIPTS"
                      ? "rgba(37,99,235,0.9)"
                      : "transparent",
                  color:
                    activeTab === "SCRIPTS"
                      ? "var(--color-text-on-accent)"
                      : "var(--color-text-soft)",
                }}
              >
                Scripts
              </button>
            </div>
          </div>

          {/* === COMPLIANCE TAB === */}
          {activeTab === "COMPLIANCE" && (
            <>
              {/* Filters + Lead Import row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1.4fr) minmax(0, 1.2fr)",
                  gap: "var(--space-4)",
                  alignItems: "flex-start",
                }}
              >
                {/* Filters */}
                <Card
                  title="Filters"
                  description="Narrow the time window and slice agent performance."
                  actions={
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={loading}
                      onClick={() => {
                        void loadComplianceData();
                      }}
                    >
                      Apply filters
                    </Button>
                  }
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: "var(--space-4)",
                    }}
                  >
                    <Input
                      label="From date"
                      type="date"
                      value={fromDate}
                      onChange={(e) =>
                        setFromDate(e.target.value)
                      }
                    />
                    <Input
                      label="To date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                    <Input
                      label="Filter agents"
                      hint="Search by userId"
                      value={agentFilter}
                      onChange={(e) =>
                        setAgentFilter(e.target.value)
                      }
                    />
                  </div>
                  {error && (
                    <div
                      style={{
                        marginTop: "var(--space-3)",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-danger)",
                      }}
                    >
                      {error}
                    </div>
                  )}
                </Card>

                {/* Lead import (CSV) */}
                <Card
                  title="Lead import (CSV)"
                  description="Upload a CSV file of leads. Required columns: firstName, lastName, phone. Optional: email, state, source."
                  actions={
                    <Button
                      size="sm"
                      isLoading={importLoading}
                      disabled={importLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        const form =
                          document.getElementById(
                            "lead-import-form"
                          ) as HTMLFormElement | null;
                        if (form) form.requestSubmit();
                      }}
                    >
                      Run import
                    </Button>
                  }
                >
                  <form
                    id="lead-import-form"
                    onSubmit={handleRunImport}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-3)",
                    }}
                  >
                    <Input
                      label="Import source label (optional)"
                      placeholder="e.g. Dialer vendor 2025-12-03"
                      value={importSource}
                      onChange={(e) =>
                        setImportSource(e.target.value)
                      }
                    />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        CSV file
                      </label>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          const file =
                            e.target.files &&
                            e.target.files[0]
                              ? e.target.files[0]
                              : null;
                          setImportFile(file);
                          setImportResult(null);
                          setImportError(null);
                        }}
                        style={{
                          fontSize: "var(--text-xs)",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-soft)",
                        }}
                      >
                        Expected headers (case-insensitive):{" "}
                        <code>
                          firstName, lastName, phone, email?, state?,
                          source?
                        </code>
                        . Duplicates are detected by primary phone.
                      </div>
                    </div>

                    {importError && (
                      <div
                        style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--color-danger)",
                        }}
                      >
                        {importError}
                      </div>
                    )}

                    {importResult && (
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-text-soft)",
                          marginTop: "var(--space-2)",
                        }}
                      >
                        <div>
                          Import job:{" "}
                          <code>{importResult.jobId}</code>
                        </div>
                        <div>
                          File:{" "}
                          <strong>
                            {importResult.filename ??
                              "(unknown)"}
                          </strong>
                        </div>
                        <div>
                          Source label:{" "}
                          <strong>
                            {importResult.source ?? "(none)"}
                          </strong>
                        </div>
                        <div>
                          Total rows:{" "}
                          <strong>
                            {importResult.totalRows}
                          </strong>
                        </div>
                        <div>
                          Created leads:{" "}
                          <strong>
                            {importResult.createdCount}
                          </strong>
                        </div>
                        <div>
                          Duplicates skipped:{" "}
                          <strong>
                            {importResult.duplicateCount}
                          </strong>
                        </div>
                        <div>
                          Failed rows:{" "}
                          <strong>
                            {importResult.failedCount}
                          </strong>
                        </div>
                      </div>
                    )}
                  </form>
                </Card>
              </div>

              {/* Summary grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(4, minmax(0, 1fr))",
                  gap: "var(--space-4)",
                }}
              >
                <Card title="Total checks">
                  <div
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {summary?.totalChecks ??
                      (loading ? "…" : "0")}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    All pre-call compliance checks in the selected
                    window.
                  </p>
                </Card>

                <Card title="Passes">
                  <div
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 600,
                      color: "var(--color-success)",
                    }}
                  >
                    {summary?.passCount ??
                      (loading ? "…" : "0")}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Calls successfully cleared under your rules engine.
                  </p>
                </Card>

                <Card title="Failures">
                  <div
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 600,
                      color: "var(--color-danger)",
                    }}
                  >
                    {summary?.failCount ??
                      (loading ? "…" : "0")}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Calls blocked due to DNC, timing, or rule
                    violations.
                  </p>
                </Card>

                <Card title="Failure rate">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {summary
                        ? `${failureRatePercent.toFixed(1)}%`
                        : loading
                        ? "…"
                        : "0.0%"}
                    </span>
                    <Badge variant={failureRateBadgeVariant}>
                      {failureRateBadgeVariant === "danger"
                        ? "High risk"
                        : failureRateBadgeVariant === "warning"
                        ? "Monitor"
                        : "Healthy"}
                    </Badge>
                  </div>
                  <p
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Failed checks divided by total in the selected
                    window.
                  </p>
                </Card>
              </div>

              {/* Middle row: purposes + agents */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1.4fr) minmax(0, 1fr)",
                  gap: "var(--space-4)",
                  alignItems: "flex-start",
                }}
              >
                {/* Checks by purpose */}
                <Card
                  title="Checks by purpose"
                  description="Which call purposes are driving the most compliance activity?"
                >
                  {(!summary ||
                    Object.keys(summary.purposes).length ===
                      0) &&
                  !loading ? (
                    <p
                      style={{
                        fontStyle: "italic",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      No compliance checks recorded in this window.
                    </p>
                  ) : (
                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "left",
                              color: "var(--color-text-soft)",
                              fontSize: "var(--text-xs)",
                              borderBottom:
                                "1px solid var(--color-border-subtle)",
                            }}
                          >
                            <th style={{ padding: "0.5rem" }}>
                              Purpose
                            </th>
                            <th
                              style={{
                                padding: "0.5rem",
                                textAlign: "right",
                              }}
                            >
                              Total
                            </th>
                            <th
                              style={{
                                padding: "0.5rem",
                                textAlign: "right",
                              }}
                            >
                              Pass
                            </th>
                            <th
                              style={{
                                padding: "0.5rem",
                                textAlign: "right",
                              }}
                            >
                              Fail
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary &&
                            Object.entries(
                              summary.purposes
                            ).map(([purpose, stats]) => (
                              <tr
                                key={purpose}
                                style={{
                                  borderBottom:
                                    "1px solid rgba(15,23,42,0.6)",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  {purpose}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                    textAlign: "right",
                                  }}
                                >
                                  {stats.total}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                    textAlign: "right",
                                    color:
                                      "var(--color-success)",
                                  }}
                                >
                                  {stats.pass}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                    textAlign: "right",
                                    color:
                                      "var(--color-danger)",
                                  }}
                                >
                                  {stats.fail}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* Checks by agent */}
                <Card
                  title="Checks by agent"
                  description="Per-agent compliance load and performance."
                >
                  {filteredAgents.length === 0 && !loading ? (
                    <p
                      style={{
                        fontStyle: "italic",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      No agent compliance activity matches this
                      filter/window.
                    </p>
                  ) : (
                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "left",
                              color: "var(--color-text-soft)",
                              fontSize: "var(--text-xs)",
                              borderBottom:
                                "1px solid var(--color-border-subtle)",
                            }}
                          >
                            <th style={{ padding: "0.5rem" }}>
                              Agent (userId)
                            </th>
                            <th
                              style={{
                                padding: "0.5rem",
                                textAlign: "right",
                              }}
                            >
                              Total
                            </th>
                            <th
                              style={{
                                padding: "0.5rem",
                                textAlign: "right",
                              }}
                            >
                              Pass
                            </th>
                            <th
                              style={{
                                padding: "0.5rem",
                                textAlign: "right",
                              }}
                            >
                              Fail
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAgents.map((agent) => (
                            <tr
                              key={agent.userId}
                              style={{
                                borderBottom:
                                  "1px solid rgba(15,23,42,0.6)",
                              }}
                            >
                              <td
                                style={{
                                  padding: "0.5rem",
                                }}
                              >
                                {agent.userId}
                              </td>
                              <td
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "right",
                                }}
                              >
                                {agent.total}
                              </td>
                              <td
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "right",
                                  color:
                                    "var(--color-success)",
                                }}
                              >
                                {agent.pass}
                              </td>
                              <td
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "right",
                                  color:
                                    "var(--color-danger)",
                                }}
                              >
                                {agent.fail}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>

              {/* Bottom row: recent imports + recent failures */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1.1fr) minmax(0, 1.2fr)",
                  gap: "var(--space-4)",
                  alignItems: "flex-start",
                }}
              >
                {/* Recent lead imports */}
                <Card
                  title="Recent lead imports"
                  description="Latest bulk lead imports into the system."
                >
                  {recentImportsError && (
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-danger)",
                        marginBottom: "var(--space-2)",
                      }}
                    >
                      {recentImportsError}
                    </div>
                  )}

                  {recentImports.length === 0 &&
                  !recentImportsError ? (
                    <p
                      style={{
                        fontStyle: "italic",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      No import jobs found yet. Upload a CSV to see
                      imports here.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                        maxHeight: "420px",
                        overflowY: "auto",
                      }}
                    >
                      {recentImports.map((job) => (
                        <div
                          key={job.id}
                          style={{
                            padding: "var(--space-3)",
                            borderRadius: "var(--radius-md)",
                            border:
                              "1px solid var(--color-border-subtle)",
                            backgroundColor:
                              "rgba(15,23,42,0.7)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "var(--text-sm)",
                                  fontWeight: 500,
                                }}
                              >
                                {job.filename ??
                                  "(Unnamed file)"}
                              </div>
                              <div
                                style={{
                                  fontSize:
                                    "var(--text-xs)",
                                  color:
                                    "var(--color-text-soft)",
                                }}
                              >
                                Source:{" "}
                                {job.source ??
                                  "(no label)"}{" "}
                                •{" "}
                                {job.createdBy
                                  ? `By ${job.createdBy.name} (${job.createdBy.email})`
                                  : "Unknown user"}
                              </div>
                            </div>
                            <Badge
                              variant={
                                job.status === "FAILED"
                                  ? "danger"
                                  : job.status === "RUNNING" ||
                                    job.status === "PENDING"
                                  ? "warning"
                                  : "success"
                              }
                            >
                              {job.status.toLowerCase()}
                            </Badge>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.75rem",
                              fontSize:
                                "var(--text-xs)",
                              color:
                                "var(--color-text-soft)",
                              marginTop: "0.25rem",
                            }}
                          >
                            <span>
                              Total:{" "}
                              <strong>
                                {job.totalRows}
                              </strong>
                            </span>
                            <span>
                              Created:{" "}
                              <strong>
                                {job.createdCount}
                              </strong>
                            </span>
                            <span>
                              Duplicates:{" "}
                              <strong>
                                {job.duplicateCount}
                              </strong>
                            </span>
                            <span>
                              Failed:{" "}
                              <strong>
                                {job.failedCount}
                              </strong>
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize:
                                "var(--text-xs)",
                              color:
                                "var(--color-text-soft)",
                              marginTop: "0.25rem",
                            }}
                          >
                            Started:{" "}
                            {job.startedAt
                              ? new Date(
                                  job.startedAt
                                ).toLocaleString()
                              : new Date(
                                  job.createdAt
                                ).toLocaleString()}
                            {job.finishedAt && (
                              <>
                                {" "}
                                • Finished:{" "}
                                {new Date(
                                  job.finishedAt
                                ).toLocaleString()}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Recent failures */}
                <Card
                  title="Recent failed checks"
                  description="The most recent pre-call checks that failed your rules. This is your daily investigation feed."
                >
                  {failures.length === 0 && !loading ? (
                    <p
                      style={{
                        fontStyle: "italic",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      No failed compliance checks recorded in this
                      window.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                        maxHeight: "420px",
                        overflowY: "auto",
                      }}
                    >
                      {failures.map((f) => (
                        <div
                          key={f.id}
                          style={{
                            padding: "var(--space-3)",
                            borderRadius: "var(--radius-md)",
                            border:
                              "1px solid var(--color-border-subtle)",
                            backgroundColor:
                              "rgba(15,23,42,0.7)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "var(--text-sm)",
                                  fontWeight: 500,
                                }}
                              >
                                Lead {f.leadId}
                              </div>
                              <div
                                style={{
                                  fontSize:
                                    "var(--text-xs)",
                                  color:
                                    "var(--color-text-soft)",
                                }}
                              >
                                Agent: {f.userId} • Purpose:{" "}
                                {f.purpose}
                              </div>
                            </div>
                            <Badge variant="danger">
                              FAIL
                            </Badge>
                          </div>
                          <div
                            style={{
                              fontSize:
                                "var(--text-xs)",
                              color:
                                "var(--color-text-soft)",
                              marginTop: "0.25rem",
                            }}
                          >
                            {new Date(
                              f.createdAt
                            ).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {loading && (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  Loading dashboard…
                </p>
              )}
            </>
          )}

          {/* === USERS TAB === */}
          {activeTab === "USERS" && (
            <Card
              title="Users & hierarchy"
              description={
                isAdmin
                  ? "Manage roles and the manager/director hierarchy for this organization."
                  : "Only admins can manage users and hierarchy."
              }
            >
              {!isAdmin ? (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  You have read-only access to this area. Contact an
                  admin to change user roles or hierarchy.
                </p>
              ) : (
                <>
                  {usersError && (
                    <div
                      style={{
                        marginBottom: "var(--space-2)",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-danger)",
                      }}
                    >
                      {usersError}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Users are scoped to your current organization.
                      Editing roles and hierarchy impacts reporting
                      visibility and dashboards.
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={usersLoading}
                      onClick={() => {
                        void loadUsers();
                      }}
                    >
                      Refresh
                    </Button>
                  </div>

                  {usersLoading && users.length === 0 ? (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Loading users…
                    </p>
                  ) : users.length === 0 ? (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      No users found for this organization.
                    </p>
                  ) : (
                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "var(--text-xs)",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "left",
                              color: "var(--color-text-soft)",
                              borderBottom:
                                "1px solid var(--color-border-subtle)",
                            }}
                          >
                            <th style={{ padding: "0.5rem" }}>
                              Name
                            </th>
                            <th style={{ padding: "0.5rem" }}>
                              Email
                            </th>
                            <th style={{ padding: "0.5rem" }}>
                              Role
                            </th>
                            <th style={{ padding: "0.5rem" }}>
                              ManagerId
                            </th>
                            <th style={{ padding: "0.5rem" }}>
                              DirectorId
                            </th>
                            <th style={{ padding: "0.5rem" }}>
                              Active
                            </th>
                            <th style={{ padding: "0.5rem" }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => {
                            const isEditing =
                              editingUserId === u.id;
                            const draft =
                              isEditing && editDraft
                                ? editDraft
                                : u;
                            return (
                              <tr
                                key={u.id}
                                style={{
                                  borderBottom:
                                    "1px solid rgba(15,23,42,0.6)",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  <div>
                                    {u.firstName}{" "}
                                    {u.lastName}
                                  </div>
                                  <div
                                    style={{
                                      fontSize:
                                        "var(--text-2xs)",
                                      color:
                                        "var(--color-text-soft)",
                                    }}
                                  >
                                    {u.id}
                                  </div>
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  {u.email}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  {isEditing ? (
                                    <select
                                      value={draft.role}
                                      onChange={(e) =>
                                        updateDraft(
                                          "role",
                                          e.target
                                            .value as AdminUserDto["role"]
                                        )
                                      }
                                      style={{
                                        fontSize:
                                          "var(--text-xs)",
                                      }}
                                    >
                                      {ROLE_OPTIONS.map(
                                        (r) => (
                                          <option
                                            key={r}
                                            value={r}
                                          >
                                            {r}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  ) : (
                                    <Badge variant="secondary">
                                      {u.role}
                                    </Badge>
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  {isEditing ? (
                                    <Input
                                      label=""
                                      value={
                                        draft.managerId ??
                                        ""
                                      }
                                      onChange={(e) =>
                                        updateDraft(
                                          "managerId",
                                          e.target.value
                                        )
                                      }
                                    />
                                  ) : (
                                    u.managerId ?? "—"
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  {isEditing ? (
                                    <Input
                                      label=""
                                      value={
                                        draft.directorId ??
                                        ""
                                      }
                                      onChange={(e) =>
                                        updateDraft(
                                          "directorId",
                                          e.target.value
                                        )
                                      }
                                    />
                                  ) : (
                                    u.directorId ?? "—"
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  {isEditing ? (
                                    <input
                                      type="checkbox"
                                      checked={
                                        draft.isActive
                                      }
                                      onChange={(e) =>
                                        updateDraft(
                                          "isActive",
                                          e.target.checked
                                        )
                                      }
                                    />
                                  ) : (
                                    <Badge
                                      variant={
                                        u.isActive
                                          ? "success"
                                          : "danger"
                                      }
                                    >
                                      {u.isActive
                                        ? "Active"
                                        : "Disabled"}
                                    </Badge>
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: "0.5rem",
                                  }}
                                >
                                  {isEditing ? (
                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        gap: "0.25rem",
                                      }}
                                    >
                                      <Button
                                        size="xs"
                                        variant="secondary"
                                        disabled={
                                          savingUserId ===
                                          u.id
                                        }
                                        onClick={
                                          cancelEditingUser
                                        }
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="xs"
                                        isLoading={
                                          savingUserId ===
                                          u.id
                                        }
                                        onClick={() => {
                                          void saveUserEdits();
                                        }}
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="xs"
                                      variant="secondary"
                                      onClick={() =>
                                        startEditingUser(
                                          u
                                        )
                                      }
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {/* === SCRIPTS TAB === */}
          {activeTab === "SCRIPTS" && (
            <Card
              title="Interactive call scripts"
              description="Manage and inspect interactive call scripts used by agents. This view is read-only for now."
            >
              {scriptsError && (
                <div
                  style={{
                    marginBottom: "var(--space-2)",
                    fontSize: "var(--text-sm)",
                    color: "var(--color-danger)",
                  }}
                >
                  {scriptsError}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1.1fr) minmax(0, 1.4fr)",
                  gap: "var(--space-4)",
                  alignItems: "flex-start",
                }}
              >
                {/* Scripts list */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Scripts are scoped to your organization. Agents
                      use these in the lead detail page via the
                      scripted call panel.
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={scriptsLoading}
                      onClick={() => {
                        void loadScripts();
                      }}
                    >
                      Refresh
                    </Button>
                  </div>

                  {scriptsLoading && scripts.length === 0 ? (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Loading scripts…
                    </p>
                  ) : scripts.length === 0 ? (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      No interactive call scripts configured yet.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        maxHeight: "420px",
                        overflowY: "auto",
                      }}
                    >
                      {scripts.map((s) => {
                        const isSelected =
                          selectedScriptId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setSelectedScriptId(s.id)
                            }
                            style={{
                              textAlign: "left",
                              borderRadius: "var(--radius-md)",
                              border: isSelected
                                ? "1px solid rgba(37,99,235,0.8)"
                                : "1px solid var(--color-border-subtle)",
                              backgroundColor: isSelected
                                ? "rgba(37,99,235,0.16)"
                                : "rgba(15,23,42,0.7)",
                              padding: "var(--space-3)",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                alignItems: "center",
                                gap: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  fontSize:
                                    "var(--text-sm)",
                                  fontWeight: 500,
                                }}
                              >
                                {s.name}
                              </div>
                              <Badge
                                variant={
                                  s.isActive
                                    ? "success"
                                    : "secondary"
                                }
                              >
                                {s.isActive
                                  ? "Active"
                                  : "Inactive"}
                              </Badge>
                            </div>
                            <div
                              style={{
                                fontSize:
                                  "var(--text-xs)",
                                color:
                                  "var(--color-text-soft)",
                              }}
                            >
                              Purpose:{" "}
                              <strong>{s.purpose}</strong>
                              {s.description
                                ? ` • ${s.description}`
                                : ""}
                            </div>
                            <div
                              style={{
                                fontSize:
                                  "var(--text-2xs)",
                                color:
                                  "var(--color-text-soft)",
                              }}
                            >
                              Script ID: {s.id}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Script detail */}
                <div>
                  {selectedScriptId == null && (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Select a script on the left to inspect its
                      nodes and branching options.
                    </p>
                  )}

                  {scriptDetailError && (
                    <div
                      style={{
                        marginBottom: "var(--space-2)",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-danger)",
                      }}
                    >
                      {scriptDetailError}
                    </div>
                  )}

                  {scriptDetailLoading && !selectedScript && (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      Loading script details…
                    </p>
                  )}

                  {selectedScript && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            fontSize: "var(--text-lg)",
                            fontWeight: 600,
                            marginBottom:
                              "var(--space-1)",
                          }}
                        >
                          {selectedScript.name}
                        </h2>
                        <p
                          style={{
                            fontSize: "var(--text-sm)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          Purpose:{" "}
                          <strong>
                            {selectedScript.purpose}
                          </strong>
                          {selectedScript.description
                            ? ` • ${selectedScript.description}`
                            : ""}
                        </p>
                        <p
                          style={{
                            marginTop: "0.25rem",
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          Entry node ID:{" "}
                          {selectedScript.entryNodeId ??
                            "None configured"}
                        </p>
                      </div>

                      <div
                        style={{
                          maxHeight: "420px",
                          overflowY: "auto",
                          borderRadius: "var(--radius-md)",
                          border:
                            "1px solid var(--color-border-subtle)",
                          padding: "var(--space-3)",
                          backgroundColor:
                            "rgba(15,23,42,0.7)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-3)",
                        }}
                      >
                        {selectedScript.nodes.length === 0 ? (
                          <p
                            style={{
                              fontSize: "var(--text-sm)",
                              color:
                                "var(--color-text-soft)",
                              fontStyle: "italic",
                            }}
                          >
                            This script has no nodes defined yet.
                          </p>
                        ) : (
                          selectedScript.nodes.map((node) => (
                            <div
                              key={node.id}
                              style={{
                                padding: "var(--space-3)",
                                borderRadius:
                                  "var(--radius-md)",
                                border:
                                  "1px solid var(--color-border-subtle)",
                                backgroundColor:
                                  "rgba(15,23,42,0.9)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize:
                                        "var(--text-sm)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {node.label ??
                                      "Untitled node"}
                                  </div>
                                  <div
                                    style={{
                                      fontSize:
                                        "var(--text-2xs)",
                                      color:
                                        "var(--color-text-soft)",
                                    }}
                                  >
                                    Node ID: {node.id}
                                  </div>
                                </div>
                                <Badge
                                  variant={
                                    node.isTerminal
                                      ? "secondary"
                                      : "success"
                                  }
                                >
                                  {node.isTerminal
                                    ? "Terminal"
                                    : "Continues"}
                                </Badge>
                              </div>
                              <div
                                style={{
                                  fontSize:
                                    "var(--text-xs)",
                                  color:
                                    "var(--color-text-soft)",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {node.content}
                              </div>
                              {node.options.length > 0 && (
                                <div
                                  style={{
                                    marginTop:
                                      "var(--space-2)",
                                    fontSize:
                                      "var(--text-2xs)",
                                    color:
                                      "var(--color-text-soft)",
                                  }}
                                >
                                  <div
                                    style={{
                                      marginBottom:
                                        "0.25rem",
                                      fontWeight: 500,
                                    }}
                                  >
                                    Options:
                                  </div>
                                  <ul
                                    style={{
                                      listStyle: "disc",
                                      paddingLeft:
                                        "1.25rem",
                                      display: "flex",
                                      flexDirection:
                                        "column",
                                      gap: "0.15rem",
                                    }}
                                  >
                                    {node.options.map(
                                      (opt) => (
                                        <li
                                          key={opt.id}
                                        >
                                          <span>
                                            {opt.label}
                                          </span>
                                          {opt.nextNodeId && (
                                            <span
                                              style={{
                                                marginLeft:
                                                  "0.35rem",
                                              }}
                                            >
                                              →
                                              nextNodeId:{" "}
                                              <code>
                                                {
                                                  opt.nextNodeId
                                                }
                                              </code>
                                            </span>
                                          )}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
};

export default Admin;

/**
 * Helper to fetch recent failures with optional from/to filters.
 * We use apiFetch directly so we can attach query params.
 */
async function fetchRecentFailuresWithFilters(
  limit: number,
  params?: { from?: string; to?: string }
): Promise<{ failures: FailureRow[] }> {
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);

  const qs = search.toString();
  const url = qs
    ? `/api/compliance/admin/recent-failures?${qs}`
    : `/api/compliance/admin/recent-failures`;

  return apiFetch<{ failures: FailureRow[] }>(url, {
    method: "GET",
  });
}

