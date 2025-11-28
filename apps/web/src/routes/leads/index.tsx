import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LeadListItemDto, LeadStatus } from "@elysium-crm/shared-types/dto/lead";

import { getLeads } from "../../lib/apiClient";

const statusOptions: (LeadStatus | "ALL")[] = [
  "ALL",
  LeadStatus.NEW,
  LeadStatus.CONTACT_ATTEMPTED,
  LeadStatus.CONTACTED,
  LeadStatus.SOA_REQUIRED,
  LeadStatus.SOA_COMPLETED,
  LeadStatus.IN_DISCUSSION,
  LeadStatus.ENROLLED,
  LeadStatus.NOT_INTERESTED,
  LeadStatus.DO_NOT_CONTACT,
];

const LeadsPage: React.FC = () => {
  const [items, setItems] = useState<LeadListItemDto[]>([]);
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
      const response = await getLeads({ page, pageSize, search, status });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load leads";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeads();
  }, [page, pageSize, search, status]);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPage(1);
    setSearch(e.target.value);
  };

  const onStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPage(1);
    setStatus(e.target.value as LeadStatus | "ALL");
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1>Leads</h1>

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search by name, email, or phone"
          value={search}
          onChange={onSearchChange}
          style={{ flex: 1, padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
        />
        <select
          value={status}
          onChange={onStatusChange}
          style={{ padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading leads...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Name",
                  "Status",
                  "Email",
                  "Phone",
                  "State",
                  "Assigned",
                  "Created",
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #e5e7eb",
                      padding: "0.5rem",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <Link to={`/leads/${lead.id}`} style={{ color: "#2563eb" }}>
                      {lead.firstName} {lead.lastName}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{lead.status.replace(/_/g, " ")}</td>
                  <td style={{ padding: "0.5rem" }}>{lead.email ?? "—"}</td>
                  <td style={{ padding: "0.5rem" }}>{lead.phone ?? "—"}</td>
                  <td style={{ padding: "0.5rem" }}>{lead.state ?? "—"}</td>
                  <td style={{ padding: "0.5rem" }}>{lead.assignedToName ?? "Unassigned"}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "0.75rem", textAlign: "center" }}>
                    No leads found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          style={{ padding: "0.5rem 1rem", borderRadius: 4, border: "1px solid #ccc", background: "white" }}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= totalPages || loading}
          style={{ padding: "0.5rem 1rem", borderRadius: 4, border: "1px solid #ccc", background: "white" }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default LeadsPage;
