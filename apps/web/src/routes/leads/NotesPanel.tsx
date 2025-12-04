// apps/web/src/routes/leads/NotesPanel.tsx

import React, { useEffect, useState } from "react";
import {
  getLeadNotes,
  createLeadNote,
  type LeadNote,
} from "../../lib/apiClient";
import { Button } from "../../components/ui/Button";

interface NotesPanelProps {
  leadId: string;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ leadId }) => {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [newBody, setNewBody] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getLeadNotes(leadId);
        if (!mounted) return;
        setNotes(res.notes || []);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load notes");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [leadId]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newBody.trim()) return;

    setSaving(true);
    setSaveError(null);

    try {
      const created = await createLeadNote(leadId, newBody.trim());
      setNewBody("");
      // Prepend note to list
      setNotes((prev) => [created, ...prev]);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <form
        onSubmit={handleAddNote}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <label
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-soft)",
          }}
        >
          New internal note
        </label>
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={3}
          placeholder="E.g. Client prefers morning calls, mentioned complex prescription list, follow up with PDP comparison."
          style={{
            width: "100%",
            resize: "vertical",
            fontSize: "var(--text-xs)",
            fontFamily: "inherit",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-subtle)",
            backgroundColor: "var(--color-bg-subtle)",
            color: "var(--color-text-primary)",
            padding: "0.5rem",
          }}
        />
        {saveError && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-danger)",
            }}
          >
            {saveError}
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            type="submit"
            size="sm"
            isLoading={saving}
            disabled={saving || !newBody.trim()}
          >
            Add note
          </Button>
        </div>
      </form>

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

      {loading && !error && (
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-soft)",
          }}
        >
          Loading notes…
        </p>
      )}

      {!loading && !error && notes.length === 0 && (
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-soft)",
            fontStyle: "italic",
          }}
        >
          No notes yet. Use this space for internal context and hand-offs.
        </p>
      )}

      {notes.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            maxHeight: "260px",
            overflowY: "auto",
          }}
        >
          {notes.map((n) => (
            <div
              key={n.id}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle)",
                backgroundColor: "rgba(15,23,42,0.7)",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-soft)",
                }}
              >
                <span>
                  {n.authorName || n.authorUserId}
                  {n.authorEmail ? ` · ${n.authorEmail}` : ""}
                </span>
                <span>
                  {new Date(
                    n.createdAt
                  ).toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {n.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

