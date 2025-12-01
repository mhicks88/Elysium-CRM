import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const response: LeadListResponse = await getLeads({
        page,
        pageSize,
        search: search.trim() || undefined,
        status,
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

  useEffect(() => {
    void fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchLeads();
  };

  const goToPreviousPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

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
                border: "1px solid #ccc",
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
              onChange={(e) =>
                setStatus(e.target.value as LeadStatus | "ALL")
              }
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

      {loading && (
        <div style={{ padding: "1rem" }}>Loading leads...</div>
      )}

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
          {leads.length === 0 ? (
            <p>No leads found.</p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "1rem",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e5e7eb",
                      padding: 8,
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e5e7eb",
                      padding: 8,
                    }}
                  >
                    Status
                  </th>
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
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e5e7eb",
                      padding: 8,
                    }}
                  >
                    State
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e5e7eb",
                      padding: 8,
                    }}
                  >
                    Assigned to
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e5e7eb",
                      padding: 8,
                    }}
                  >
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
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
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              Page {page} of {totalPages}
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
        </section>
      )}
    </div>
  );
};

export default LeadsPage;

