// apps/web/src/routes/leads/LeadImport.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  uploadLeadImportCsv,
  getRecentLeadImports,
  type LeadImportJobSummary,
} from "../../lib/apiClient";

const LeadImportPage: React.FC = () => {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    jobId: string;
    filename: string | null;
    source: string | null;
    totalRows: number;
    createdCount: number;
    duplicateCount: number;
    failedCount: number;
  } | null>(null);

  const [jobs, setJobs] = useState<LeadImportJobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState<boolean>(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  async function loadJobs() {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const res = await getRecentLeadImports(10);
      setJobs(res.jobs || []);
    } catch (err: any) {
      setJobsError(err?.message ?? "Failed to load recent imports");
    } finally {
      setJobsLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError("Please select a CSV file to upload.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const res = await uploadLeadImportCsv(file, {
        source: source.trim() || undefined,
      });
      setUploadResult(res);
      // Refresh recent jobs after upload
      void loadJobs();
    } catch (err: any) {
      setUploadError(err?.message ?? "Failed to upload lead CSV");
    } finally {
      setUploading(false);
    }
  }

  function renderJobsTable() {
    if (jobsLoading && jobs.length === 0 && !jobsError) {
      return (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
          }}
        >
          Loading recent imports…
        </p>
      );
    }

    if (jobsError) {
      return (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-danger)",
          }}
        >
          {jobsError}
        </p>
      );
    }

    if (jobs.length === 0) {
      return (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
            fontStyle: "italic",
          }}
        >
          No import jobs found yet.
        </p>
      );
    }

    return (
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
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <th style={{ padding: "0.5rem" }}>Job</th>
              <th style={{ padding: "0.5rem" }}>File / Source</th>
              <th style={{ padding: "0.5rem" }}>Status</th>
              <th style={{ padding: "0.5rem" }}>Rows</th>
              <th style={{ padding: "0.5rem" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr
                key={job.id}
                style={{
                  borderBottom: "1px solid rgba(15,23,42,0.6)",
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
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      {job.id}
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
                    <span>{job.filename ?? "Unnamed file"}</span>
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-soft)",
                      }}
                    >
                      {job.source ?? "No source label"}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {job.status}
                  </span>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {job.totalRows} rows • created {job.createdCount} • dup{" "}
                    {job.duplicateCount} • failed {job.failedCount}
                  </span>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobsLoading && (
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-soft)",
            }}
          >
            Updating import list…
          </p>
        )}
      </div>
    );
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
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/leads")}
            >
              ← Back to leads
            </Button>
          </div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
            }}
          >
            Lead import
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              maxWidth: "40rem",
            }}
          >
            Upload CSV files of leads and track recent import jobs. Large
            lists should come through here instead of manual entry.
          </p>
        </div>

        {/* Upload form */}
        <Card
          title="Upload lead CSV"
          description="Select a CSV file and an optional source label to start an import."
        >
          <form
            onSubmit={handleUpload}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                gap: "var(--space-4)",
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
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  CSV file
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    setFile(picked);
                    setUploadResult(null);
                    setUploadError(null);
                  }}
                  style={{
                    fontSize: "var(--text-sm)",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-soft)",
                  }}
                >
                  Expected: header row + one lead per row. Mapping is handled
                  server-side.
                </span>
              </div>

              <Input
                label="Source label (optional)"
                hint="e.g., 'Fall 2025 campaign', 'Vendor: Sunfire'"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>

            {uploadError && (
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-danger)",
                }}
              >
                {uploadError}
              </div>
            )}

            {uploadResult && (
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-soft)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border-subtle)",
                  padding: "var(--space-3)",
                  backgroundColor: "rgba(15,23,42,0.6)",
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    marginBottom: "0.25rem",
                  }}
                >
                  Import created (job {uploadResult.jobId})
                </div>
                <div>
                  Total rows: {uploadResult.totalRows} • created{" "}
                  {uploadResult.createdCount} • duplicates{" "}
                  {uploadResult.duplicateCount} • failed{" "}
                  {uploadResult.failedCount}
                </div>
              </div>
            )}

            <div>
              <Button
                type="submit"
                isLoading={uploading}
                disabled={uploading || !file}
              >
                Start import
              </Button>
            </div>
          </form>
        </Card>

        {/* Recent jobs */}
        <Card
          title="Recent import jobs"
          description="Recent CSV imports for this organization."
        >
          {renderJobsTable()}
        </Card>
      </div>
    </AppShell>
  );
};

export default LeadImportPage;

