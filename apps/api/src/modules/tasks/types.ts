// apps/api/src/modules/tasks/types.ts

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface Task {
  id: string;
  leadId: string;
  title: string;
  description?: string | null;
  assignedToUserId?: string | null;
  status: TaskStatus;
  dueAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  leadId: string;
  title: string;
  description?: string | null;
  assignedToUserId?: string | null;
  status?: TaskStatus;
  dueAt?: Date | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assignedToUserId?: string | null;
  status?: TaskStatus;
  dueAt?: Date | null;
}

