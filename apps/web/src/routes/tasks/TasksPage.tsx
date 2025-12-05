// apps/web/src/routes/tasks/TasksPage.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import {
  getTasksList,
  updateTask,
  type TaskDto,
  type ApiTaskStatus,
} from "../../lib/apiClient";
import { useAuth } from "../../lib/auth";

type TaskFilterStatus = ApiTaskStatus | "ALL";

type Role =
  | "ADMIN"
  | "AGENT"
  | "VIEW_ONLY"
  | "MANAGER"
  | "DIRECTOR"
  | "COMPLIANCE_OFFICER";

const statusLabel: Record<ApiTaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

function statusBadgeVariant(status: ApiTaskStatus) {
  switch (status) {
    case "OPEN":
      return "warning" as const;
    case "IN_PROGRESS":
      return "secondary" as const;
    case "DONE":
      return "success" as const;
    case "CANCELLED":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

const TasksPage: React.FC = () => {
  const { user } = useAuth() as { user: any | null };
  const userRole = (user?.role ?? null) as Role | null;

  // Backend lets only ADMIN / MANAGER / AGENT mutate tasks.
  const canWriteTasks =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "AGENT";

  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] =
    useState<TaskFilterStatus>("OPEN");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        limit: 200,
      };
      if (statusFilter !== "ALL") {
        params.status = statusFilter;
      } else {
        params.status = "ALL";
      }
      if (overdueOnly) {
        params.overdueOnly = true;
      }

      const res = await getTasksList(params);
      setTasks(res.tasks || []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTasks = tasks.filter((t) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    const haystack = [
      t.title,
      t.description ?? "",
      t.leadId,
      t.assignedToUserId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });

  const openCount = tasks.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "IN_PROGRESS"
  ).length;
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const cancelledCount = tasks.filter(
    (t) => t.status === "CANCELLED"
  ).length;

  async function handleQuickStatusChange(
    task: TaskDto,
    nextStatus: ApiTaskStatus
  ) {
    if (!canWriteTasks) return;

    setUpdatingId(task.id);
    setError(null);
    try {
      const updated = await updateTask(task.leadId, task.id, {
        status: nextStatus,
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? updated : t))
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to update task");
    } finally {
      setUpdatingId(null);
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
        {/* Header */}
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
            Tasks
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-soft)",
              maxWidth: "40rem",
            }}
          >
            Central queue of follow-ups, callbacks, and operational work
            linked to your leads. Use this view to drive your day instead of
            hunting through individual leads.
          </p>
        </div>

        {/* Summary cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <Card title="Total tasks">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {tasks.length}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Across all leads.
            </p>
          </Card>

          <Card title="Open">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {openCount}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Not yet started.
            </p>
          </Card>

          <Card title="In progress">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {inProgressCount}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Currently being worked.
            </p>
          </Card>

          <Card title="Completed / cancelled">
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 600,
              }}
            >
              {doneCount + cancelledCount}
            </div>
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-soft)",
              }}
            >
              Closed tasks.
            </p>
          </Card>
        </div>

        {/* Filters */}
        <Card
          title="Filters"
          description="Focus on the tasks that matter most."
          actions={
            <Button
              variant="secondary"
              size="sm"
              isLoading={loading}
              onClick={() => {
                void loadTasks();
              }}
            >
              Refresh
            </Button>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)",
              gap: "var(--space-4)",
              alignItems: "flex-end",
            }}
          >
            <Input
              label="Search"
              placeholder="Title, description, leadId, assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

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
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as TaskFilterStatus
                  )
                }
                style={{
                  fontSize: "var(--text-sm)",
                  padding: "0.35rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "var(--color-bg-subtle)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <input
                id="overdue-only"
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              <label
                htmlFor="overdue-only"
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-soft)",
                }}
              >
                Overdue only (due date in the past)
              </label>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: "var(--space-3)",
                fontSize: "var(--text-sm)",
                color: "var(--color-danger)",
              }}
            >
              {error}
            </div>
          )}
        </Card>

        {/* Tasks table */}
        <Card
          title="Task queue"
          description={
            filteredTasks.length === 0
              ? "No tasks match your current filters."
              : `Showing ${filteredTasks.length} of ${tasks.length} tasks.`
          }
        >
          {loading && tasks.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              Loading tasks…
            </p>
          ) : filteredTasks.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-soft)",
              }}
            >
              No tasks found. Try broadening your filters.
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
                    <th style={{ padding: "0.5rem" }}>Task</th>
                    <th style={{ padding: "0.5rem" }}>Lead</th>
                    <th style={{ padding: "0.5rem" }}>Status</th>
                    <th style={{ padding: "0.5rem" }}>Due</th>
                    <th style={{ padding: "0.5rem" }}>Created</th>
                    <th style={{ padding: "0.5rem" }}>Assignee</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const isOverdue =
                      task.dueAt &&
                      new Date(task.dueAt).getTime() <
                        Date.now() &&
                      task.status !== "DONE" &&
                      task.status !== "CANCELLED";

                    const showActions = canWriteTasks;

                    return (
                      <tr
                        key={task.id}
                        style={{
                          borderBottom:
                            "1px solid rgba(15,23,42,0.6)",
                          backgroundColor: isOverdue
                            ? "rgba(127,29,29,0.2)"
                            : "transparent",
                        }}
                      >
                        <td style={{ padding: "0.5rem" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.15rem",
                            }}
                          >
                            <span>{task.title}</span>
                            {task.description && (
                              <span
                                style={{
                                  fontSize: "var(--text-xs)",
                                  color: "var(--color-text-soft)",
                                }}
                              >
                                {task.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <Link
                            to={`/leads/${task.leadId}`}
                            style={{
                              color: "var(--color-primary)",
                              textDecoration: "none",
                              fontSize: "var(--text-xs)",
                            }}
                          >
                            {task.leadId}
                          </Link>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <Badge
                            variant={statusBadgeVariant(task.status)}
                          >
                            {statusLabel[task.status]}
                          </Badge>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: isOverdue
                                ? "var(--color-danger)"
                                : "var(--color-text-soft)",
                            }}
                          >
                            {formatDate(task.dueAt)}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--color-text-soft)",
                            }}
                          >
                            {formatDate(task.createdAt)}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--color-text-soft)",
                            }}
                          >
                            {task.assignedToUserId ?? "—"}
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
                            {showActions && task.status !== "OPEN" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={updatingId === task.id}
                                onClick={() =>
                                  void handleQuickStatusChange(
                                    task,
                                    "OPEN"
                                  )
                                }
                              >
                                Reopen
                              </Button>
                            )}
                            {showActions &&
                              task.status === "OPEN" && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={updatingId === task.id}
                                  onClick={() =>
                                    void handleQuickStatusChange(
                                      task,
                                      "IN_PROGRESS"
                                    )
                                  }
                                >
                                  Start
                                </Button>
                              )}
                            {showActions &&
                              task.status !== "DONE" && (
                                <Button
                                  size="sm"
                                  disabled={updatingId === task.id}
                                  onClick={() =>
                                    void handleQuickStatusChange(
                                      task,
                                      "DONE"
                                    )
                                  }
                                >
                                  Complete
                                </Button>
                              )}
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

export default TasksPage;

