// apps/web/src/components/tasks/TasksPanel.tsx
import React, { useEffect, useState } from "react";
import {
  Task,
  TaskStatus,
  createTaskForLead,
  deleteTaskForLead,
  listTasksForLead,
  updateTaskForLead,
} from "../../lib/tasksApi";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";

export interface TasksPanelProps {
  leadId: string;
}

const statusLabel: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

function statusBadgeVariant(status: TaskStatus) {
  switch (status) {
    case "DONE":
      return "success" as const;
    case "CANCELLED":
      return "danger" as const;
    case "IN_PROGRESS":
      return "warning" as const;
    case "OPEN":
    default:
      return "neutral" as const;
  }
}

export const TasksPanel: React.FC<TasksPanelProps> = ({ leadId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState<string>("");
  const [newDueDate, setNewDueDate] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await listTasksForLead(leadId);
        if (!mounted) return;
        setTasks(data);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load tasks");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const created = await createTaskForLead(leadId, {
        title: newTitle.trim(),
        dueAt: newDueDate ? newDueDate : null,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTitle("");
      setNewDueDate("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(task: Task, status: TaskStatus) {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateTaskForLead(task.leadId, task.id, {
        status,
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(task: Task) {
    setSaving(true);
    setError(null);
    try {
      await deleteTaskForLead(task.leadId, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete task");
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
          Tasks
        </h2>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
            marginTop: "0.15rem",
          }}
        >
          Lightweight todos tied to this lead. Use them for SLAs, follow-ups,
          and handoffs between agents.
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

      {/* New task form */}
      <form
        onSubmit={handleCreateTask}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) auto",
          gap: "var(--space-3)",
          alignItems: "flex-end",
        }}
      >
        <Input
          label="New task"
          placeholder="Call back, verify documents, schedule follow-up…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <Input
          label="Due date"
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          isLoading={saving}
          disabled={saving || !newTitle.trim()}
        >
          Add
        </Button>
      </form>

      {/* Tasks list */}
      {loading ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
          }}
        >
          Loading tasks…
        </p>
      ) : tasks.length === 0 ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-soft)",
          }}
        >
          No tasks yet for this lead. Create one above to start tracking work.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle)",
                backgroundColor: "rgba(15,23,42,0.7)",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-3)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.15rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                    }}
                  >
                    {task.title}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-soft)",
                    }}
                  >
                    Created{" "}
                    {new Date(task.createdAt).toLocaleString()}
                    {task.dueAt
                      ? ` • Due ${new Date(
                          task.dueAt
                        ).toLocaleDateString()}`
                      : ""}
                  </span>
                </div>
                <Badge variant={statusBadgeVariant(task.status)}>
                  {statusLabel[task.status]}
                </Badge>
              </div>

              {task.description && (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {task.description}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  marginTop: "0.25rem",
                }}
              >
                {task.status !== "OPEN" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => handleStatusChange(task, "OPEN")}
                  >
                    Mark open
                  </Button>
                )}
                {task.status !== "IN_PROGRESS" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() =>
                      handleStatusChange(task, "IN_PROGRESS")
                    }
                  >
                    In progress
                  </Button>
                )}
                {task.status !== "DONE" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => handleStatusChange(task, "DONE")}
                  >
                    Done
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleDelete(task)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

