// apps/web/src/components/enrollment/EnrollmentPanel.tsx
import React, { useEffect, useState } from "react";
import {
  Enrollment,
  EnrollmentStage,
  getEnrollmentForLead,
  upsertEnrollmentForLead,
} from "../../lib/enrollmentApi";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export interface EnrollmentPanelProps {
  leadId: string;
}

/**
 * EnrollmentPanel
 *
 * Self-contained panel to view and update enrollment state for a lead.
 * This does NOT wrap itself in a Card – the parent (LeadDetail) should
 * decide how to place it in the layout.
 */
export const EnrollmentPanel: React.FC<EnrollmentPanelProps> = ({
  leadId,
}) => {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<EnrollmentStage>("NOT_STARTED");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getEnrollmentForLead(leadId);
        if (!mounted) return;

        if (data) {
          setEnrollment(data);
          setStage(data.stage);
          setNotes(data.notes ?? "");
        } else {
          // No enrollment yet – start at NOT_STARTED
          setEnrollment(null);
          setStage("NOT_STARTED");
          setNotes("");
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load enrollment");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await upsertEnrollmentForLead(leadId, {
        stage,
        notes: notes.trim() || null,
      });
      setEnrollment(updated);
      setStage(updated.stage);
      setNotes(updated.notes ?? "");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save enrollment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <div>
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 600,
          }}
        >
          Enrollment
        </h2>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
            marginTop: "0.15rem",
          }}
        >
          Track this lead&apos;s journey from first contact to fully enrolled.
        </p>
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

      {loading ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
          }}
        >
          Loading enrollment…
        </p>
      ) : (
        <form
          onSubmit={handleSave}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 2fr)",
              gap: "var(--space-4)",
            }}
          >
            {/* Stage selector */}
            <div>
              <label
                htmlFor="enrollment-stage"
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                }}
              >
                Stage
              </label>
              <select
                id="enrollment-stage"
                value={stage}
                onChange={(e) =>
                  setStage(e.target.value as EnrollmentStage)
                }
                style={{
                  width: "100%",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "rgba(15,23,42,0.9)",
                  color: "var(--color-text)",
                  padding: "0.6rem 0.75rem",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                  transition:
                    "border-color var(--transition-fast), box-shadow var(--transition-fast)",
                }}
              >
                <option value="NOT_STARTED">Not started</option>
                <option value="DISCOVERY">Discovery / consult</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="PENDING_DOCS">Pending documents</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <Input
                label="Notes"
                hint="Optional context on where this lead is in the journey."
                as={undefined as never} // keep Input props happy if strict
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{
                  marginTop: "0.4rem",
                  width: "100%",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "rgba(15,23,42,0.9)",
                  color: "var(--color-text)",
                  padding: "0.6rem 0.75rem",
                  fontSize: "var(--text-sm)",
                  outline: "none",
                  resize: "vertical",
                }}
                placeholder="Add quick context about blockers, next steps, or why this lead is at this stage."
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
            }}
          >
            <Button
              type="submit"
              isLoading={saving}
              disabled={saving}
            >
              Save enrollment
            </Button>
          </div>

          {enrollment && (
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Last updated:{" "}
              {new Date(enrollment.updatedAt).toLocaleString()}
            </p>
          )}
        </form>
      )}
    </div>
  );
};

