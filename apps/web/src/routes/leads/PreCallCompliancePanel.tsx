// apps/web/src/routes/leads/PreCallCompliancePanel.tsx

import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { runPreCallCheck } from "../../lib/apiClient";

interface PreCallCompliancePanelProps {
  leadId: string;
}

type CallPurpose = "EDUCATION" | "MARKETING" | "ENROLLMENT" | "SERVICE";

export const PreCallCompliancePanel: React.FC<
  PreCallCompliancePanelProps
> = ({ leadId }) => {
  const [purpose, setPurpose] = useState<CallPurpose>("ENROLLMENT");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunCheck(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await runPreCallCheck({
        leadId,
        purpose,
        // callSessionId is optional; we can associate later if needed
        callSessionId: undefined as any,
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? "Failed to run pre-call compliance check");
    } finally {
      setLoading(false);
    }
  }

  const status =
    (result?.overallStatus as string | undefined) ??
    (result?.status as string | undefined) ??
    null;

  let statusLabel = "Not run";
  let statusVariant: "success" | "danger" | "warning" | "neutral" = "neutral";

  if (status === "PASS" || status === "COMPLIANT") {
    statusLabel = "Pass";
    statusVariant = "success";
  } else if (status === "FAIL" || status === "NON_COMPLIANT") {
    statusLabel = "Fail";
    statusVariant = "danger";
  } else if (status) {
    statusLabel = status;
    statusVariant = "warning";
  }

  // Give the select a stable, unique id so the label can point to it
  const purposeSelectId = `precall-purpose-${leadId}`;

  return (
    <form
      onSubmit={handleRunCheck}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: "var(--space-3)",
          alignItems: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <label
            htmlFor={purposeSelectId}
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Call purpose
          </label>
          <select
            id={purposeSelectId}
            name="callPurpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as CallPurpose)}
            style={{
              fontSize: "var(--text-sm)",
              padding: "0.35rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-subtle)",
              backgroundColor: "var(--color-bg-subtle)",
              color: "var(--color-text-primary)",
            }}
          >
            <option value="ENROLLMENT">ENROLLMENT</option>
            <option value="EDUCATION">EDUCATION</option>
            <option value="MARKETING">MARKETING</option>
            <option value="SERVICE">SERVICE</option>
          </select>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-2xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Used both for compliance rules and to pick a default scripted call.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "0.15rem",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-2xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Current result
            </span>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>

          <Button
            type="submit"
            size="sm"
            isLoading={loading}
            disabled={loading}
          >
            Run pre-call check
          </Button>
        </div>
      </div>

      {error && (
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: "0.25rem",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-soft)",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
        >
          {typeof result.summary === "string" && result.summary.trim().length > 0 && (
            <div>{result.summary}</div>
          )}

          {/* Raw JSON fallback for debug / compliance trace */}
          <div
            style={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle)",
              backgroundColor: "rgba(15,23,42,0.7)",
              maxHeight: "200px",
              overflow: "auto",
              padding: "0.5rem 0.6rem",
            }}
          >
            <pre
              style={{
                margin: 0,
                fontFamily: "monospace",
                fontSize: "0.7rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </form>
  );
};

