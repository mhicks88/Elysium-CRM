// apps/web/src/lib/tasksApi.ts
//
// Frontend Tasks API client for lead-scoped tasks.
// Talks to the backend routes in apps/api/src/modules/tasks/routes.ts.
//
// Endpoints used:
//   GET    /api/tasks/:leadId
//   POST   /api/tasks/:leadId
//   PATCH  /api/tasks/:leadId/:taskId
//   DELETE /api/tasks/:leadId/:taskId
//

import { apiFetch } from "./apiClient";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface Task {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  assignedToUserId: string;
  status: TaskStatus;
  dueAt: string | null; // ISO string or null
  createdAt: string;     // ISO string
  updatedAt: string;     // ISO string
}

interface TaskCreatePayload {
  title: string;
  description?: string | null;
  assignedToUserId?: string;
  status?: TaskStatus;
  dueAt?: string | null; // ISO date (YYYY-MM-DD) or null
}

interface TaskUpdatePayload {
  title?: string;
  description?: string | null;
  assignedToUserId?: string | null;
  status?: TaskStatus;
  dueAt?: string | null; // ISO date or null
}

/**
 * List tasks for a given lead.
 */
export async function listTasksForLead(leadId: string): Promise<Task[]> {
  const res = await apiFetch<any[]>(`/api/tasks/${encodeURIComponent(leadId)}`, {
    method: "GET",
  });

  // Backend already returns serialized strings; we just trust them.
  return (res ?? []) as Task[];
}

/**
 * Create a new task for a lead.
 *
 * This mirrors the backend POST /api/tasks/:leadId body:
 * { title, description?, assignedToUserId?, status?, dueAt? }
 */
export async function createTaskForLead(
  leadId: string,
  payload: TaskCreatePayload
): Promise<Task> {
  const body = {
    title: payload.title,
    description:
      payload.description !== undefined ? payload.description : undefined,
    assignedToUserId:
      payload.assignedToUserId !== undefined
        ? payload.assignedToUserId
        : undefined,
    status: payload.status,
    dueAt: payload.dueAt,
  };

  const res = await apiFetch<Task>(`/api/tasks/${encodeURIComponent(leadId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return res;
}

/**
 * Update an existing task for a lead.
 *
 * PATCH /api/tasks/:leadId/:taskId
 */
export async function updateTaskForLead(
  leadId: string,
  taskId: string,
  payload: TaskUpdatePayload
): Promise<Task> {
  const body = {
    title: payload.title,
    description:
      payload.description !== undefined ? payload.description : undefined,
    assignedToUserId:
      payload.assignedToUserId !== undefined
        ? payload.assignedToUserId
        : undefined,
    status: payload.status,
    dueAt: payload.dueAt,
  };

  const res = await apiFetch<Task>(
    `/api/tasks/${encodeURIComponent(leadId)}/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );

  return res;
}

/**
 * Delete a task for a lead.
 *
 * DELETE /api/tasks/:leadId/:taskId
 */
export async function deleteTaskForLead(
  leadId: string,
  taskId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/tasks/${encodeURIComponent(leadId)}/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
    }
  );
}

