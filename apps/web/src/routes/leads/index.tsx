// apps/web/src/routes/leads/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { getLeads, updateLead } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

type LeadStatus = "NEW" | "IN_PROGRESS" | "ENROLLED" | "DO_NOT_CONTACT";

interface LeadListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  // Optional compliance flags if backend provides them
  permissionToContactPhone?: boolean;
  doNotContact?: boolean;
  // Optional assignment info if backend provides it
  assignedToUserId?: string | null;
}

const statusLabel: Record<LeadStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  ENROLLED: "Enrolled",
  DO_NOT_CONTACT: "Do Not Contact",
};

function statusBadgeVariant(status: LeadStatus) {
  switch (status) {
    case "ENROLLED":
      return "success" as const;
    case "DO_NOT_CONTACT":
      return "danger" as const;
    case "IN_PROGRESS":
      return "warning" as const;
    case "NEW":
    default:
      return "neutral" as const;
  }
}

/**
 * Normalize whatever getLeads() returns into an array of leads.
 */
function normalizeLeadsResponse(raw: any): LeadListItem[] {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw as LeadListItem[];
  if (Array.isArray(raw.items)) return raw.items as LeadListItem[];
  if (Array.isArray(raw.leads)) return raw.leads as LeadListItem[];
  if (Array.isArray(raw.data)) return raw.data as LeadListItem[];
  if (Array.isArray(raw.results)) return raw.results as LeadListItem[];

  return [];
}

/**
 * Derive contact compliance status for a lead, based on flags if present,
 * otherwise fall back to status.
 */
function computeContactCompliance(lead: LeadListItem) {
  const isDnc =
    lead.doNotContact === true || lead.status === "DO_NOT_CONTACT";

  const hasPermissionFlag =
    typeof lead.permissionToContactPhone === "boolean";
  const permPhone = lead.permissionToContactPhone;

  if (isDnc) {
    return {
      label: "DNC",
      description: "Do not contact by phone.",
      variant: "danger" as const,
    };
  }

  if (hasPermissionFlag && permPhone === false) {
    return {
      label: "No phone permission",
      description: "Permission to contact by phone not on file.",
      variant: "warning" as const,
    };
  }

  return {
    label: "OK to contact",
    description: "Contact permitted by phone.",
    variant: "success" as const,
  };
}

const LeadsIndex: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth() as { user: any | null };
  const currentUserId = user?.id ?? null;

  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");
  const [showMyLeadsOnly, setShowMyLeadsOnly] = useState<boolean>(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = await getLeads();
        if (!mounted) return;

        const normalized = normalizeLeadsResponse(raw);
        setLeads(normalized);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load leads");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "ALL" && lead.status !== statusFilter) {
        return false;
      }

      if (showMyLeadsOnly && currentUserId) {
        if (lead.assignedToUserId !== currentUserId) {
          return false;
        }
      }

      if (!term) return true;

      const haystack = [
        lead.firstName,
        lead.lastName,
        lead.email,
        lead.phone,
        lead.state,
        lead.assignedToUserId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [leads, search, statusFilter, showMyLeadsOnly, currentUserId]);

  const counts = useMemo(() => {
    const base: Record<LeadStatus | "total", number> = {
      total: leads.length,
      NEW: 0,
      IN_PROGRESS: 0,
      ENROLLED: 0,
      DO_NOT_CONTACT: 0,
    };

    for (const lead of leads) {
      base[lead.status] += 1;
    }

    return base;
  }, [leads]);

  const myLeadsCount =
    currentUserId == null
      ? 0
      : leads.filter((l) => l.assignedToUserId === currentUserId).length;

  async function handleAssignToMe(lead: LeadListItem) {
    if (!currentUserId) return;
    setAssigningId(lead.id);
    setError(null);
    try {
      await updateLead(lead.id, {
        assignedToUserId: currentUserId,
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                assignedToUserId: currentUserId,
              }
            : l
        )
      );
    } catch (err: any) {
      setError(
        err?.message ?? "Failed to assign lead to current user"
      );
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <AppShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Page header */}
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
            Leads
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              maxWidth: "40rem",
            }}
          >
            Your central queue of inbound and outbound leads. Use filters to
            focus on what actually needs action, not the entire universe.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <Card title="Something went wrong">
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </p>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </div>
          </Card>
        )}

        {/* Summary cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <Card title="Total leads">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {counts.total}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              All leads in the system.
            </p>
          </Card>

          <Card title="New">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {counts.NEW}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Leads that have not been touched yet.
            </p>
          </Card>

          <Card title="In progress">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {counts.IN_PROGRESS}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Leads currently being worked by agents.
            </p>
          </Card>

          <Card title="Enrolled">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {counts.ENROLLED}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Leads successfully converted into enrollments.
            </p>
          </Card>
        </div>

        {/* Filters + actions */}
        <Card
          title="Filters & actions"
          description="Slice by status and search by name, email, phone, state, or assignee."
          actions={
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              {currentUserId && (
                <Button
                  variant={showMyLeadsOnly ? "primary" : "secondary"}
                  size="sm"
                  onClick={() =>
                    setShowMyLeadsOnly((prev) => !prev)
                  }
                >
                  {showMyLeadsOnly
                    ? `Showing my leads (${myLeadsCount})`
                    : `My leads (${myLeadsCount})`}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  navigate("/leads/new");
                }}
              >
                + New lead
              </Button>
            </div>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
              gap: "var(--space-4)",
              alignItems: "flex-end",
            }}
          >
            <Input
              label="Search"
              hint="Name, email, phone, state, or assignee userId"
              placeholder="Start typing to filter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {(["ALL", "NEW", "IN_PROGRESS", "ENROLLED", "DO_NOT_CONTACT"] as const).map(
                (statusKey) => {
                  const isActive = statusFilter === statusKey;
                  const label =
                    statusKey === "ALL"
                      ? "All"
                      : statusLabel[statusKey as LeadStatus];

                  return (
                    <Button
                      key={statusKey}
                      variant={isActive ? "primary" : "secondary"}
                      size="sm"
                      onClick={() =>
                        setStatusFilter(
                          statusKey === "ALL"
                            ? "ALL"
                            : (statusKey as LeadStatus)
                        )
                      }
                    >
                      {label}
                    </Button>
                  );
                }
              )}
            </div>
          </div>
        </Card>

        {/* Leads table */}
        <Card
          title="Lead queue"
          description={
            filteredLeads.length === 0
              ? "No leads match your current filters."
              : `Showing ${filteredLeads.length} of ${leads.length} leads.`
          }
        >
          {loading && leads.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Loading leads…
            </p>
          ) : filteredLeads.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No leads found. Try broadening your filters.
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
                    <th style={{ padding: "0.5rem" }}>Assignee</th>
                    <th style={{ padding: "0.5rem" }}>Location</th>
                    <th style={{ padding: "0.5rem" }}>Status</th>
                    <th style={{ padding: "0.5rem" }}>Contact status</th>
                    <th style={{ padding: "0.5rem" }}>Created</th>
                    <th style={{ padding: "0.5rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const contactStatus = computeContactCompliance(lead);
                    const canAssignToMe =
                      !!currentUserId &&
                      lead.assignedToUserId !== currentUserId;

                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom:
                            "1px solid rgba(15,23,42,0.6)",
                        }}
                      >
                        <td style={{ padding: "0.5rem" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.1rem",
                            }}
                          >
                            <span>
                              {lead.firstName} {lead.lastName}
                            </span>
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--color-text-soft)",
                              }}
                            >
                              #{lead.id}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.1rem",
                            }}
                          >
                            {lead.email && <span>{lead.email}</span>}
                            {lead.phone && (
                              <span
                                style={{
                                  fontSize: "var(--text-xs)",
                                  color: "var(--color-text-soft)",
                                }}
                              >
                                {lead.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          {lead.assignedToUserId ? (
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--color-text-soft)",
                              }}
                            >
                              {lead.assignedToUserId}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--color-text-soft)",
                                fontStyle: "italic",
                              }}
                            >
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          {lead.state ? (
                            lead.state
                          ) : (
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                color: "var(--color-text-soft)",
                              }}
                            >
                              Unknown
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <Badge variant={statusBadgeVariant(lead.status)}>
                            {statusLabel[lead.status]}
                          </Badge>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <Badge variant={contactStatus.variant}>
                            {contactStatus.label}
                          </Badge>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--color-text-soft)",
                            }}
                          >
                            {new Date(
                              lead.createdAt
                            ).toLocaleDateString()}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "0.25rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            {canAssignToMe && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={
                                  assigningId === lead.id
                                }
                                onClick={() =>
                                  void handleAssignToMe(lead)
                                }
                              >
                                {assigningId === lead.id
                                  ? "Assigning…"
                                  : "Assign to me"}
                              </Button>
                            )}
                            <Link to={`/leads/${lead.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default LeadsIndex;
