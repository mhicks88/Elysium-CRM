import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getLeads } from "../../lib/apiClient";

// Local types for the leads list UI.
// These mirror what the API returns but are defined here so we don't
// depend on the shared-types package while things are stabilizing.

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
  assignedToName: string | null;
}

interface LeadListResponse {
  items: LeadListItem[];
  page: number;
  pageSize: number;
  total: number;
}

const statusOptions: (LeadStatus | "ALL")[] = [
  "ALL",
  "NEW",
  "IN_PROGRESS",
  "ENROLLED",
  "DO_NOT_CONTACT",
];

type SortField = "name" | "status" | "state" | "createdAt";
type SortDirection = "asc" | "desc";

const parsePage = (raw: string | null): number => {
  if (!raw) return 1;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return parsed;
};

const parseStatus = (raw: string | null): LeadStatus | "ALL" => {
  if (!raw || raw === "ALL") return "ALL";

  const validStatuses: LeadStatus[] = [
    "NEW",
    "IN_PROGRESS",
    "ENROLLED",
    "DO_NOT_CONTACT",
  ];

  if (validStatuses.includes(raw as LeadStatus)) {
    return raw as LeadStatus;
  }

  return "ALL";
};

const parseSortField = (raw: string | null): SortField => {
  const valid: SortField[] = ["name", "status", "state", "createdAt"];
  if (!raw || !valid.includes(raw as SortField)) {
    return "createdAt";
  }
  return raw as SortField;
};

const parseSortDirection = (raw: string | null): SortDirection => {
  if (raw === "asc" || raw === "desc") {
    return raw;
  }
  return "desc";
};

const LeadsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL on first render
  const [page, setPage] = useState<number>(() => parsePage(searchParams.get("page")));
  const [pageSize] = useState<number>(25); // fixed for now
  const [search, setSearch] = useState<string>(() => searchParams.get("search") ?? "");
  const [status, setStatus] = useState<LeadStatus | "ALL">(() =>
    parseStatus(searchParams.get("status"))
  );
  const [sortField, setSortField] = useState<SortField>(() =>
    parseSortField(searchParams.get("sortField"))
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(() =>
    parseSortDirection(searchParams.get("sortDir"))
  );

  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Keep URL query params in sync with current state
  useEffect(() => {
    const params: Record<string, string> = {};

    if (page && page !== 1) {
      params.page = String(page);
    }

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      params.search = trimmedSearch;
    }

    if (status && status !== "ALL") {
      params.status = status;
    }

    // Persist sort if it differs from default (createdAt desc)
    if (!(sortField === "createdAt" && sortDirection === "desc")) {
      params.sortField = sortField;
      params.sortDir = sortDirection;
    }

    setSearchParams(params, { replace: true });
  }, [page, search, status, sortField, sortDirection, setSearchParams]);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const trimmedSearch = search.trim();
      const statusFilter = status === "ALL" ? undefined : status;

      const response: LeadListResponse = await getLeads({
        page,
        pageSize,
        search: trimmedSearch || undefined,
        status: statusFilter,
      });

      setLeads(response.items);
      setTotal(response.total);
    } catch (err: any) {
      const message =
        err instanceof Error ? err.message : "Failed to load leads";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch whenever the "query state" changes (excluding sort, which is client-side)
  useEffect(() => {
    void fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Ensure we reset to page 1 when user "confirms" the search.
    setPage(1);
    // No direct fetch here; useEffect will pick up the page change.
  };

  const goToPreviousPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleSort = (field: SortField) => {
    setSortField((currentField) => {
      if (currentField === field) {
        // Toggle direction
        setSortDirection((currentDir) => (currentDir === "asc" ? "desc" : "asc"));
        return currentField;
      }

      // New field: default to ascending
      setSortDirection("asc");
      return field;
    });
  };

  const sortedLeads = useMemo(() => {
    const copy = [...leads];

    copy.sort((a, b) => {
      const directionMultiplier = sortDirection === "asc" ? 1 : -1;

      const compareStrings = (x: string | null | undefined, y: string | null | undefined) => {
        const sx = (x ?? "").toLowerCase();
        const sy = (y ?? "").toLowerCase();
        if (sx < sy) return -1;
        if (sx > sy) return 1;
        return 0;
      };

      switch (sortField) {
        case "name": {
          const lastNameCompare = compareStrings(a.lastName, b.lastName);
          if (lastNameCompare !== 0) return lastNameCompare * directionMultiplier;
          const firstNameCompare = compareStrings(a.firstName, b.firstName);
          return firstNameCompare * directionMultiplier;
        }
        case "status": {
          const cmp = compareStrings(a.status, b.status);
          return cmp * directionMultiplier;
        }
        case "state": {
          const cmp = compareStrings(a.state, b.state);
          return cmp * directionMultiplier;
        }
        case "createdAt": {
          const da = new Date(a.createdAt).getTime();
          const db = new Date(b.createdAt).getTime();
          if (da < db) return -1 * directionMultiplier;
          if (da > db) return 1 * directionMultiplier;
          return 0;
        }
        default:
          return 0;
      }
    });

    return copy;
  }, [leads, sortField, sortDirection]);

  const renderSortableHeader = (
    label: string,
    field: SortField,
    align: "left" | "right" = "left"
  ) => {
    const isActive = sortField === field;
    const arrow =
      !isActive ? "" : sortDirection === "asc" ? " ▲" : " ▼";

    return (
      <th
        style={{
          textAlign: align,
          borderBottom: "1px solid #e5e7eb",
          padding: 8,
        }}
      >
        <button
          type="button"
          onClick={() => handleSort(field)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            font: "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: isActive ? "#111827" : "#4b5563",
          }}
        >
          <span>{label}</span>
          {arrow && <span>{arrow}</span>}
        </button>
      </th>
    );
  };

  // Compute result range for "Showing X–Y of Z"
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex =
    total === 0
      ? 0
      : Math.min(startIndex + sortedLeads.length - 1, total);

  return (
    <div style={{ padding: "1.5rem" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h1>Elysium CRM – Leads</h1>
        <Link
          to="/leads/new"
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 4,
            backgroundColor: "#2563eb",
            color: "white",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Create Lead
        </Link>
      </header>

      <section
        style={{
          border: "1px solid #e5e7eb",
          padding: "1rem",
          borderRadius: 6,
          marginBottom: "1rem",
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
        >
          <div style={{ flex: 1 }}>
            <label
              htmlFor="search"
              style={{ display: "block", marginBottom: 4, fontSize: 14 }}
            >
              Search (name, email, phone)
            </label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 4,
                border: "1px solid " + "#ccc",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="status"
              style={{ display: "block", marginBottom: 4, fontSize: 14 }}
            >
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => {
                const value = e.target.value as LeadStatus | "ALL";
                setStatus(value);
                setPage(1);
              }}
              style={{
                padding: 8,
                borderRadius: 4,
                border: "1px solid #ccc",
              }}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf: "flex-end" }}>
            <button
              type="submit"
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: 4,
                border: "none",
                backgroundColor: "#2563eb",
                color: "white",
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {loading && <div style={{ padding: "1rem" }}>Loading leads...</div>}

      {error && (
        <div style={{ padding: "1rem", color: "red" }}>{error}</div>
      )}

      {!loading && !error && (
        <section
          style={{
            border: "1px solid #e5e7eb",
            padding: "1rem",
            borderRadius: 6,
          }}
        >
          {sortedLeads.length === 0 ? (
            <p>No leads found.</p>
          ) : (
            <>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: "1rem",
                }}
              >
                <thead>
                  <tr>
                    {renderSortableHeader("Name", "name")}
                    {renderSortableHeader("Status", "status")}
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 8,
                      }}
                    >
                      Email
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 8,
                      }}
                    >
                      Phone
                    </th>
                    {renderSortableHeader("State", "state")}
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 8,
                      }}
                    >
                      Assigned to
                    </th>
                    {renderSortableHeader("Created", "createdAt")}
                  </tr>
                </thead>
                <tbody>
                  {sortedLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 8,
                        }}
                      >
                        <Link
                          to={`/leads/${lead.id}`}
                          style={{ color: "#2563eb", textDecoration: "none" }}
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 8,
                        }}
                      >
                        {lead.status.replace(/_/g, " ")}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 8,
                        }}
                      >
                        {lead.email ?? "—"}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 8,
                        }}
                      >
                        {lead.phone ?? "—"}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 8,
                        }}
                      >
                        {lead.state ?? "—"}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 8,
                        }}
                      >
                        {lead.assignedToName ?? "Unassigned"}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 8,
                        }}
                      >
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  {total > 0 ? (
                    <>
                      <div>
                        Showing {startIndex}–{endIndex} of {total} results
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 2,
                        }}
                      >
                        Page {page} of {totalPages}
                      </div>
                    </>
                  ) : (
                    <div>No results</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={goToPreviousPage}
                    disabled={page <= 1}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      backgroundColor: page <= 1 ? "#f3f4f6" : "white",
                      cursor: page <= 1 ? "default" : "pointer",
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={goToNextPage}
                    disabled={page >= totalPages}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      backgroundColor: page >= totalPages ? "#f3f4f6" : "white",
                      cursor: page >= totalPages ? "default" : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default LeadsPage;

