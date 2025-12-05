import type {
  PreCallComplianceRequestDto,
  PreCallComplianceResponseDto,
} from "@elysium-crm/shared-types/dto/compliance";

// Base URL for the API – configured via Vite env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// Helper to build full URLs
function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

// Simple fetch-based API client with automatic access-token refresh.

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(buildUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      setAccessToken(null);
      return null;
    }

    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch (_err) {
    setAccessToken(null);
    return null;
  }
}

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch<T = unknown>(
  input: string,
  init: ApiOptions = {}
): Promise<T> {
  const { auth = true, ...rest } = init;

  const headers: HeadersInit = {
    ...(rest.headers || {}),
  };

  const hasContentTypeHeader = Object.keys(headers).some(
    (k) => k.toLowerCase() === "content-type"
  );

  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;

  if (!hasContentTypeHeader && !isFormData) {
    (headers as any)["Content-Type"] = "application/json";
  }

  if (auth && accessToken) {
    (headers as any)["Authorization"] = `Bearer ${accessToken}`;
  }

  const url = buildUrl(input as string);

  const firstResponse = await fetch(url, {
    ...rest,
    headers,
    credentials: rest.credentials ?? "include",
  });

  if (!auth || firstResponse.status !== 401) {
    if (!firstResponse.ok) {
      const text = await firstResponse.text();
      throw new Error(
        `API error ${firstResponse.status}: ${text || firstResponse.statusText}`
      );
    }

    const text = await firstResponse.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const retryHeaders: HeadersInit = {
    ...headers,
    Authorization: `Bearer ${newAccessToken}`,
  };

  const retryResponse = await fetch(url, {
    ...rest,
    headers: retryHeaders,
    credentials: rest.credentials ?? "include",
  });

  if (!retryResponse.ok) {
    const text = await retryResponse.text();
    throw new Error(
      `API error ${retryResponse.status} (after refresh): ${
        text || retryResponse.statusText
      }`
    );
  }

  const retryText = await retryResponse.text();
  if (!retryText) return undefined as T;
  return JSON.parse(retryText) as T;
}

// -----------------------------------------------------------------------------
// AUTH
// -----------------------------------------------------------------------------

export async function login(payload: { email: string; password: string }) {
  const res = await fetch(buildUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Login failed");
  }

  return res.json();
}

// -----------------------------------------------------------------------------
// COMPLIANCE
// -----------------------------------------------------------------------------

export async function runPreCallCheck(
  payload: PreCallComplianceRequestDto
): Promise<PreCallComplianceResponseDto> {
  return apiFetch<PreCallComplianceResponseDto>(
    "/api/compliance/pre-call-check",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// -----------------------------------------------------------------------------
// LEADS
// -----------------------------------------------------------------------------

export type ApiTaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export async function getLeads(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
} = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });

  const queryString = search.toString();
  const url = queryString ? `/api/leads?${queryString}` : "/api/leads";

  return apiFetch<any>(url, { method: "GET" });
}

export async function getLeadById(id: string) {
  return apiFetch<any>(`/api/leads/${id}`, { method: "GET" });
}

export async function getNextLead() {
  return apiFetch<any>("/api/leads/next", { method: "GET" });
}

export async function updateLead(
  id: string,
  payload: Record<string, unknown>
) {
  return apiFetch<any>(`/api/leads/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createLead(payload: Record<string, unknown>) {
  return apiFetch<any>("/api/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -----------------------------------------------------------------------------
// TASKS
// -----------------------------------------------------------------------------

export type TaskDto = {
  id: string;
  leadId: string;
  organizationId: string;
  assignedToUserId: string;
  title: string;
  description: string | null;
  status: ApiTaskStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getTasksList(params: {
  status?: ApiTaskStatus | "ALL";
  overdueOnly?: boolean;
  limit?: number;
} = {}): Promise<{ tasks: TaskDto[] }> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.overdueOnly) search.set("overdueOnly", "true");
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }

  const qs = search.toString();
  const url = qs ? `/api/tasks?${qs}` : "/api/tasks";

  return apiFetch<{ tasks: TaskDto[] }>(url, {
    method: "GET",
  });
}

export async function updateTask(
  leadId: string,
  taskId: string,
  payload: Partial<{
    title: string;
    description: string | null;
    assignedToUserId: string | null;
    status: ApiTaskStatus;
    dueAt: string | null;
  }>
): Promise<TaskDto> {
  return apiFetch<TaskDto>(
    `/api/tasks/${encodeURIComponent(leadId)}/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

// -----------------------------------------------------------------------------
// AUDIT LOG
// -----------------------------------------------------------------------------

export async function getAuditEvents(leadId: string) {
  return apiFetch<{ events: any[]; nextCursor?: string | null }>(
    `/api/audit/${leadId}`,
    {
      method: "GET",
    }
  );
}

// -----------------------------------------------------------------------------
// COMPLIANCE HISTORY
// -----------------------------------------------------------------------------

export async function getComplianceHistory(leadId: string) {
  return apiFetch<{ history: any[] }>(`/api/compliance/history/${leadId}`, {
    method: "GET",
  });
}

// -----------------------------------------------------------------------------
// COMPLIANCE ADMIN DASHBOARD
// -----------------------------------------------------------------------------

export async function getComplianceSummary(params?: {
  from?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);

  const qs = search.toString();
  const url = qs
    ? `/api/compliance/admin/summary?${qs}`
    : `/api/compliance/admin/summary`;

  return apiFetch<{
    totalChecks: number;
    passCount: number;
    failCount: number;
    failRate: number;
    purposes: Record<
      string,
      { total: number; pass: number; fail: number }
    >;
    firstCheckAt: string | null;
    lastCheckAt: string | null;
  }>(url, { method: "GET" });
}

export async function getComplianceStatsByAgent(params?: {
  from?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);

  const qs = search.toString();
  const url = qs
    ? `/api/compliance/admin/by-agent?${qs}`
    : `/api/compliance/admin/by-agent`;

  return apiFetch<{
    agents: {
      userId: string;
      total: number;
      pass: number;
      fail: number;
    }[];
  }>(url, { method: "GET" });
}

export async function getRecentComplianceFailures(limit = 20) {
  const url = `/api/compliance/admin/recent-failures?limit=${limit}`;
  return apiFetch<{
    failures: {
      id: string;
      leadId: string;
      userId: string;
      purpose: string;
      status: "PASS" | "FAIL";
      result: any;
      createdAt: string;
    }[];
  }>(url, { method: "GET" });
}

// -----------------------------------------------------------------------------
// CALL SCRIPTS (INTERACTIVE)
// -----------------------------------------------------------------------------

export type CallScriptNode = {
  id: string;
  label: string | null;
  content: string;
  isTerminal: boolean;
  options: {
    id: string;
    label: string;
    nextNodeId: string | null;
  }[];
};

export type CallScript = {
  id: string;
  name: string;
  purpose: string;
  description: string | null;
  isActive: boolean;
  entryNodeId: string | null;
  nodes: CallScriptNode[];
};

export type ScriptRunStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export type CallScriptRunSummary = {
  id: string;
  scriptId: string;
  scriptName: string;
  purpose: string;
  status: string;
  outcome: string | null;
  startedAt: string;
  endedAt: string | null;
  agentId: string;
};

export async function getCallScripts(purpose?: string) {
  const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : "";
  return apiFetch<{ scripts: CallScript[] }>(
    `/api/call-scripts${qs}`,
    { method: "GET" }
  );
}

export async function getCallScriptById(scriptId: string) {
  return apiFetch<{ script: CallScript }>(
    `/api/call-scripts/${encodeURIComponent(scriptId)}`,
    { method: "GET" }
  );
}

export async function startCallScriptRun(params: {
  leadId: string;
  scriptId?: string;
  purpose?: string;
}) {
  return apiFetch<{
    runId: string;
    script: CallScript;
    currentNode: CallScriptNode | null;
  }>("/api/call-scripts/start", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function stepCallScriptRun(runId: string, optionId: string) {
  return apiFetch<{
    runId: string;
    status: ScriptRunStatus;
    currentNode: CallScriptNode | null;
  }>(`/api/call-scripts/runs/${encodeURIComponent(runId)}/step`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
}

export async function endCallScriptRun(params: {
  runId: string;
  outcome?: string;
  status?: ScriptRunStatus;
}) {
  const { runId, outcome, status } = params;
  return apiFetch<{ success: boolean }>(
    `/api/call-scripts/runs/${encodeURIComponent(runId)}/end`,
    {
      method: "POST",
      body: JSON.stringify({
        outcome,
        status,
      }),
    }
  );
}

export async function getCallScriptRunsForLead(leadId: string) {
  return apiFetch<{ runs: CallScriptRunSummary[] }>(
    `/api/call-scripts/leads/${encodeURIComponent(leadId)}/runs`,
    {
      method: "GET",
    }
  );
}

// -----------------------------------------------------------------------------
// CALLS (SESSIONS)
// -----------------------------------------------------------------------------

export type CallSessionDto = {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string;
  dialerIntegrationId: string;
  externalCallId: string;
  direction: string;
  purpose: string;
  status: string;
  complianceState: string;
  startedAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  recordingUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getCalls(params: {
  leadId?: string;
  limit?: number;
} = {}): Promise<{ calls: CallSessionDto[] }> {
  const search = new URLSearchParams();
  if (params.leadId) search.set("leadId", params.leadId);
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }

  const qs = search.toString();
  const url = qs ? `/api/calls?${qs}` : "/api/calls";

  return apiFetch<{ calls: CallSessionDto[] }>(url, {
    method: "GET",
  });
}

export async function getCallById(
  id: string
): Promise<CallSessionDto> {
  return apiFetch<CallSessionDto>(`/api/calls/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function createCall(params: {
  leadId: string;
  direction: "INBOUND" | "OUTBOUND";
  purpose: "EDUCATION" | "MARKETING" | "ENROLLMENT" | "SERVICE";
  status?: string;
  externalCallId?: string;
  startedAt?: string;
  connectedAt?: string;
  endedAt?: string;
}): Promise<CallSessionDto> {
  return apiFetch<CallSessionDto>("/api/calls", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Coaching notes
export type CallCoachingNote = {
  id: string;
  callId: string;
  score: number | null;
  notes: string;
  createdAt: string;
  coachUserId: string | null;
  coachName: string | null;
  coachEmail: string | null;
};

export async function getCallCoachingNotes(
  callId: string
): Promise<{ notes: CallCoachingNote[] }> {
  return apiFetch<{ notes: CallCoachingNote[] }>(
    `/api/calls/${encodeURIComponent(callId)}/coaching`,
    {
      method: "GET",
    }
  );
}

export async function addCallCoachingNote(
  callId: string,
  payload: { score?: number; notes: string }
): Promise<CallCoachingNote> {
  return apiFetch<CallCoachingNote>(
    `/api/calls/${encodeURIComponent(callId)}/coaching`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// Dispositions
export type CallDisposition =
  | "NO_ANSWER"
  | "LEFT_VOICEMAIL"
  | "CALLBACK"
  | "NOT_INTERESTED"
  | "QUALIFIED"
  | "TRANSFERRED"
  | "INVALID_NUMBER"
  | "OTHER";

export async function setCallDisposition(
  callId: string,
  payload: {
    disposition: CallDisposition;
    callbackAt?: string | null;
    notes?: string;
  }
): Promise<{
  callId: string;
  disposition: CallDisposition;
  callbackAt: string | null;
  createdTaskId: string | null;
  newLeadStatus: string | null;
}> {
  return apiFetch<{
    callId: string;
    disposition: CallDisposition;
    callbackAt: string | null;
    createdTaskId: string | null;
    newLeadStatus: string | null;
  }>(`/api/calls/${encodeURIComponent(callId)}/disposition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Coaching queue
export type CoachingQueueItem = {
  callId: string;
  leadId: string;
  agentId: string;
  direction: string;
  purpose: string;
  status: string;
  startedAt: string | null;
  lastCoachedAt: string;
  lastScore: number | null;
  noteCount: number;
};

export async function getCoachingQueue(limit = 50): Promise<{
  items: CoachingQueueItem[];
}> {
  const url = `/api/calls/coaching-queue/list?limit=${encodeURIComponent(
    String(limit)
  )}`;
  return apiFetch<{ items: CoachingQueueItem[] }>(url, {
    method: "GET",
  });
}

// -----------------------------------------------------------------------------
// NOTES (Internal per lead)
// -----------------------------------------------------------------------------

export type LeadNote = {
  id: string;
  leadId: string;
  body: string;
  createdAt: string;
  authorUserId: string;
  authorName: string | null;
  authorEmail: string | null;
};

export async function getLeadNotes(
  leadId: string
): Promise<{ notes: LeadNote[] }> {
  return apiFetch<{ notes: LeadNote[] }>(
    `/api/notes/${encodeURIComponent(leadId)}`,
    {
      method: "GET",
    }
  );
}

export async function createLeadNote(
  leadId: string,
  body: string
): Promise<LeadNote> {
  return apiFetch<LeadNote>(`/api/notes/${encodeURIComponent(leadId)}`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// -----------------------------------------------------------------------------
// LEAD IMPORT – CSV UPLOAD + JOB LIST
// -----------------------------------------------------------------------------

export type LeadCsvImportSummary = {
  jobId: string;
  filename: string | null;
  source: string | null;
  totalRows: number;
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
};

export type LeadImportJobSummary = {
  id: string;
  filename: string | null;
  source: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  totalRows: number;
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: {
    id: string;
    email: string;
    name: string;
  } | null;
};

export async function uploadLeadImportCsv(
  file: File,
  options: { source?: string } = {}
): Promise<LeadCsvImportSummary> {
  const form = new FormData();
  form.append("file", file);
  if (options.source) {
    form.append("source", options.source);
  }

  return apiFetch<LeadCsvImportSummary>("/api/leads/import", {
    method: "POST",
    body: form,
  });
}

export async function getRecentLeadImports(limit = 10): Promise<{
  jobs: LeadImportJobSummary[];
}> {
  const url = `/api/leads/import/jobs?limit=${encodeURIComponent(
    String(limit)
  )}`;
  return apiFetch<{ jobs: LeadImportJobSummary[] }>(url, {
    method: "GET",
  });
}

// -----------------------------------------------------------------------------
// DASHBOARD
// -----------------------------------------------------------------------------

export type DashboardResponse = any;

export async function getDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/api/dashboard", {
    method: "GET",
  });
}

// -----------------------------------------------------------------------------
// USERS ADMIN
// -----------------------------------------------------------------------------

export type AdminUserDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "DIRECTOR" | "AGENT" | "COMPLIANCE" | "READ_ONLY";
  isActive: boolean;
  managerId: string | null;
  directorId: string | null;
};

export async function getUsersAdmin(): Promise<{
  users: AdminUserDto[];
}> {
  return apiFetch<{ users: AdminUserDto[] }>("/api/users", {
    method: "GET",
  });
}

export async function updateUserAdmin(
  userId: string,
  payload: Partial<{
    role: AdminUserDto["role"];
    managerId: string | null;
    directorId: string | null;
    isActive: boolean;
  }>
): Promise<AdminUserDto> {
  return apiFetch<AdminUserDto>(
    `/api/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

// -----------------------------------------------------------------------------
// TEAM ACTIVITY REPORTS
// -----------------------------------------------------------------------------

export type TeamActivityReport = {
  calls: {
    total: number;
    byStatus: { status: string; count: number }[];
    byPurpose: { purpose: string; count: number }[];
    byAgent: { agentId: string; callCount: number }[];
  };
  leads: {
    byStatus: { status: string; count: number }[];
  };
  tasks: {
    open: number;
    completed: number;
    cancelled: number;
    overdueOpen: number;
  };
};

export async function getTeamActivityReport(params?: {
  from?: string;
  to?: string;
}): Promise<TeamActivityReport> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  const url = qs
    ? `/api/reports/activity?${qs}`
    : `/api/reports/activity`;

  return apiFetch<TeamActivityReport>(url, { method: "GET" });
}

// -----------------------------------------------------------------------------
// SCRIPT USAGE REPORTS
// -----------------------------------------------------------------------------

export type ScriptUsageRow = {
  scriptId: string;
  scriptName: string;
  purpose: string;
  isActive: boolean;
  runCount: number;
  completedCount: number;
  abandonedCount: number;
  completionRate: number;
  lastRunAt: string | null;
};

export async function getScriptUsageReport(params?: {
  from?: string;
  to?: string;
}): Promise<{ scripts: ScriptUsageRow[] }> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  const url = qs
    ? `/api/reports/scripts/usage?${qs}`
    : `/api/reports/scripts/usage`;

  return apiFetch<{ scripts: ScriptUsageRow[] }>(url, {
    method: "GET",
  });
}

