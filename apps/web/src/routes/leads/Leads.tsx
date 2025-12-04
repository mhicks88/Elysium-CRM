// apps/web/src/routes/leads/Leads.tsx

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { getLeads } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

type Role =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE"
  | "READ_ONLY";

type LeadStatus =
  | "NEW"
  | "CONTACT_ATTEMPTED"
  | "CONTACTED"
  | "SOA_REQUIRED"
  | "SOA_COMPLETED"
  | "IN_DISCUSSION"
  | "ENROLLED"
  | "NOT_INTERESTED"
  | "DO_NOT_CONTACT";

interface LeadRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  permissionToContactPhone: boolean;
  doNotContact: boolean;
  assignedToUserId: string | null;
  score?: number;
}

const LeadsPage: React.FC = () => {
  const { user } = useAuth() as { user: any | null };
  const role = (user?.role ?? null) as Role | null;
  const navigate = useNavigate();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] =
    useState<LeadStatus | "ALL">("NEW");
  const [sortBy, setSortBy] =
    useState<"score" | "createdAt" | "updatedAt">("score");
  const [sortOrder, setSortOrder] =
    useState<"asc" | "desc">("desc");
  const [nextLoading, setNextLoading] = useState<boolean>(false); // placeholder if you want Next here later

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;
      params.sortBy = sortBy;
      params.sortOrder = sortOrder;
      const res = (await getLeads(params)) as LeadRow[];
      setLeads(res || []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function statusBadgeVariant(status: LeadStatus) {
    switch (status) {
      case "ENROLLED":
        return "success" as const;
      case "DO_NOT_CONTACT":
        return "danger" as const;
      case "IN_DISCUSSION":
      case "CONTACTED":
      case "CONTACT_ATTEMPTED":
      case "SOA_REQUIRED":
      case "SOA_COMPLETED":
        return "warning" as const;
      case "NOT_INTERESTED":
        return "neutral" as const;
      case "NEW":
      default:
        return "neutral" as const;
    }
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  const headerTitle =
    role === "AGENT"
      ? "My leads"
      : role === "MANAGER" || role === "DIRECTOR"
      ? "Team leads"
      : role === "ADMIN"
      ? "Organization leads"
      : "Leads";

  const headerSubtitle =
    role === "AGENT"
      ? "Leads assigned to you, prioritized for your next call."
      : role === "MANAGER" || role === "DIRECTOR"
      ? "Leads across your team hierarchy, sorted by priority."
      : role === "ADMIN"
      ? "Leads across the organization; use filters to focus on specific slices."
      : "Leads visible to your role.";

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                }}
              >
                {headerTitle}
              </h1>
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-soft)",
                  maxWidth: "40rem",
                }}
              >
                {headerSubtitle}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/leads/new")}
              >
                + New lead
              </Button>
              <Button
                size="sm"
                onClick={() => navigate("/leads/import")}
              >
                Import CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card
          title="Filters"
          description="Search and sort leads in your scope."
          actions={
            <Button
              variant="secondary"
              size="sm"
              isLoading={loading}
              onClick={() => {
                void loadLeads();
              }}
            >
              Apply
            </Button>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: "var(--space-4)",
              alignItems: "flex-end",
            }}
          >
            <Input
              label="Search"
              placeholder="Name, email, phone, state, assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as LeadStatus | "ALL"
                  )
                }
                style={{
                  fontSize: "var(--text-sm)",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "var(--color-bg-subtle)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="ALL">All</option>
                <option value="NEW">New</option>
                <option value="CONTACT_ATTEMPTED">
                  Contact Attempted
                </option>
                <option value="CONTACTED">Contacted</option>
                <option value="IN_DISCUSSION">In discussion</option>
                <option value="SOA_REQUIRED">SOA required</option>
                <option value="SOA_COMPLETED">SOA completed</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="NOT_INTERESTED">Not interested</option>
                <option value="DO_NOT_CONTACT">Do Not Contact</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as "score" | "createdAt" | "updatedAt"
                  )
                }
                style={{
                  fontSize: "var(--text-sm)",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "var(--color-bg-subtle)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="score">Score (priority)</option>
                <option value="createdAt">Created at</option>
                <option value="updatedAt">Last updated</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                Sort order
              </label>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(
                    e.target.value === "asc" ? "asc" : "desc"
                  )
                }
                style={{
                  fontSize: "var(--text-sm)",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "var(--color-bg-subtle)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="desc">High → Low</option>
                <option value="asc">Low → High</option>
              </select>
            </div>
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

        {/* Leads table */}
        <Card
          title="Leads"
          description="Leads in your scope, scored and sorted."
        >
          {leads.length === 0 && !loading ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
                fontStyle: "italic",
              }}
            >
              No leads found for this filter.
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
                    <th style={{ padding: "0.5rem" }}>Lead</th>
                    <th style={{ padding: "0.5rem" }}>Contact</th>
                    <th style={{ padding: "0.5rem" }}>State</th>
                    <th style={{ padding: "0.5rem" }}>Status</th>
                    <th style={{ padding: "0.5rem" }}>Score</th>
                    <th style={{ padding: "0.5rem" }}>Assignee</th>
                    <th style={{ padding: "0.5rem" }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      style={{
                        borderBottom:
                          "1px solid rgba(15,23,42,0.6)",
                        backgroundColor: lead.doNotContact
                          ? "rgba(127,29,29,0.25)"
                          : !lead.permissionToContactPhone
                          ? "rgba(120,53,15,0.25)"
                          : "transparent",
                      }}
                    >
                      <td style={{ padding: "0.5rem" }}>
                        <Link
                          to={`/leads/${lead.id}`}
                          style={{
                            color: "var(--color-primary)",
                            textDecoration: "none",
                          }}
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <div>{lead.phone ?? "—"}</div>
                        <div
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-soft)",
                          }}
                        >
                          {lead.email ?? ""}
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {lead.state ?? "—"}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <Badge
                          variant={statusBadgeVariant(lead.status)}
                        >
                          {lead.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: "var(--text-sm)",
                          }}
                        >
                          {typeof lead.score === "number"
                            ? lead.score
                            : 0}
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {lead.assignedToUserId ?? "—"}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loading && (
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Loading leads…
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default LeadsPage;

