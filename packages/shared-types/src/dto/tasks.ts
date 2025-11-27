import { TaskPriority, TaskStatus, TaskType } from '../enums';

export interface TaskDTO {
  id: string;
  organizationId: string;
  leadId: string;
  assignedToUserId: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description: string;
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDTO {
  organizationId: string;
  leadId: string;
  assignedToUserId: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description: string;
  dueAt?: string;
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {}
