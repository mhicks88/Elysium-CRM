import React, { useState } from "react";
import {
  PlannedCallPurpose,
  PreCallCheckResultDto,
} from "@elysium-crm/shared-types/dto/compliance";

import { runPreCallCheck } from "../../lib/apiClient";

const purposeOptions: PlannedCallPurpose[] = [
  "EDUCATION",
  "MARKETING",
  "ENROLLMENT",
  "SERVICE",
];

const CompliancePage: React.FC = () => {
  const [leadId, setLeadId] = useState<string>("");
  const [purpose, setPurpose] = useState<PlannedCallPurpose>("EDUCATION");
  const [result, setResult] = useState<PreCallCheckResultDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await runPreCallCheck({
        leadId,
        purpose,
      });
      setResult(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1>Pre-Call Compliance Check</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: "1rem", maxWidth: 480 }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="leadId" style={{ display: "block", marginBottom: 4 }}>
            Lead ID
          </label>
          <input
            id="leadId"
            type="text"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            required
            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="purpose" style={{ display: "block", marginBottom: 4 }}>
            Call Purpose
          </label>
          <select
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as PlannedCallPurpose)}
            style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
          >
            {purposeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "0.5rem 1.5rem", borderRadius: 4, border: "none", backgroundColor: "#2563eb", color: "white", cursor: "pointer" }}
        >
          {loading ? "Running..." : "Run pre-call check"}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: "1rem", color: "red" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2>Results</h2>
          <p>
            Overall status: <strong>{result.status}</strong>
          </p>
          {result.reasons.length > 0 && (
            <div>
              <p>Reasons:</p>
              <ul>
                {result.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <h3>Checks</h3>
          <div>
            {result.checks.map((check, idx) => (
              <div
                key={`${check.type}-${idx}`}
                style={{
                  border: "1px solid #e5e7eb",
                  padding: "0.75rem",
                  borderRadius: 4,
                  marginBottom: "0.5rem",
                }}
              >
                <div>
                  <strong>Type:</strong> {check.type}
                </div>
                <div>
                  <strong>Status:</strong> {check.status}
                </div>
                {check.message && (
                  <div>
                    <strong>Message:</strong> {check.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompliancePage;
