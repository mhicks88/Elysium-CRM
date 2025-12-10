// apps/web/src/lib/apiClient.ts
//
// Single API client for the Elysium CRM web app.
// Uses fetch + cookie-based auth, with VITE_API_URL as an optional base URL.
//
// All paths here are API-relative (e.g. "/api/leads").
// If VITE_API_URL is set, we prepend it; otherwise we hit same-origin.

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") ?? "";

// Optional in-memory access token for Bearer auth (if used).
let accessToken: string | null = null;

/**
 * Set or clear the access token used for Authorization: Bearer ... headers.
 * If your backend is purely cookie-based, this is mostly for compatibility
 * with existing auth.tsx, but it also lets you support token auth if needed.
 */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Basic error shape from backend
export interface ApiErrorPayload {
  error?: string;
  message?: string;
  [key: string]: any;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url =
    path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${API_BASE_URL}${path}`;

  const headers: HeadersInit = {
    ...(options.headers ?? {}),
  };

  // Attach Authorization header if we have an in-memory token and none is provided explicitly.
  if (accessToken && !("Authorization" in headers)) {
    (headers as any)["Authorization"] = `Bearer ${accessToken}`;
  }

  // Default JSON headers if body is plain object / string.
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = hasBody && options.body instanceof FormData;
  if (hasBody && !isFormData && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  const text = await resp.text();
  const isJson =
    resp.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json") ?? false;
  const data = isJson && text ? JSON.parse(text) : (text as any);

  if (!resp.ok) {
    const errPayload = (data ?? {}) as ApiErrorPayload;
    const msg =
      errPayload.error ||
      errPayload.message ||
      `Request failed with status ${resp.status}`;
    const error = new Error(msg) as any;
    error.status = resp.status;
    error.payload = errPayload;
    throw error;
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Shared small types
// ---------------------------------------------------------------------------

export type Id = string;

export interface Paginated<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Auth / user (minimal surface; most auth logic is in useAuth hook)
// ---------------------------------------------------------------------------

export interface CurrentUser {
  id: string;
  email: string;
  role:
    | "ADMIN"
    | "AGENT"
    | "VIEW_ONLY"
    | "MANAGER"
    | "DIRECTOR"
    | "COMPLIANCE"
    | "READ_ONLY"
    | "COMPLIANCE_OFFICER";
  organizationId: string;
  organizationName?: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/api/auth/me", {
    method: "GET",
  });
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutApi(): Promise<void> {
  await apiFetch<void>("/api/auth/logout", {
    method: "POST",
  });
}

/**
 * Organization signup (creates org + initial admin user).
 * Used by SignupOrg.tsx.
 */
export async function signupOrg(payload: any): Promise<any> {
  return apiFetch<any>("/api/auth/signup-org", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export type LeadStatus =
  | "NEW"
  | "CONTACT_ATTEMPTED"
  | "CONTACTED"
  | "SOA_REQUIRED"
  | "SOA_COMPLETED"
  | "IN_DISCUSSION"
  | "ENROLLED"
  | "NOT_INTERESTED"
  | "DO_NOT_CONTACT";

export interface LeadListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDetailDto extends LeadListItem {
  permissionToContactPhone: boolean;
  doNotContact: boolean;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
}

export async function getLeads(params?: {
  status?: LeadStatus;
  search?: string;
  assignedToMe?: boolean;
}): Promise<{ leads: LeadListItem[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.assignedToMe) query.set("assignedToMe", "true");

  const qs = query.toString();
  const path = qs ? `/api/leads?${qs}` : `/api/leads`;
  return apiFetch<{ leads: LeadListItem[] }>(path, {
    method: "GET",
  });
}

export async function getLeadById(id: string): Promise<LeadDetailDto> {
  return apiFetch<LeadDetailDto>(
    `/api/leads/${encodeURIComponent(id)}`,
    {
      method: "GET",
    }
  );
}

export async function createLead(payload: {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
}): Promise<LeadDetailDto> {
  return apiFetch<LeadDetailDto>("/api/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLead(
  id: string,
  payload: Record<string, unknown>
): Promise<LeadDetailDto> {
  return apiFetch<LeadDetailDto>(
    `/api/leads/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function getNextLead(): Promise<LeadListItem | null> {
  const res = await apiFetch<{ lead: LeadListItem | null }>(
    "/api/work/next-lead",
    {
      method: "GET",
    }
  );
  return res.lead ?? null;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type ApiTaskStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED";

export interface TaskDto {
  id: string;
  leadId: string | null;
  title: string;
  description: string | null;
  status: ApiTaskStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getTasksList(params?: {
  status?: ApiTaskStatus;
  leadId?: string;
}): Promise<{ tasks: TaskDto[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.leadId) query.set("leadId", params.leadId);

  const qs = query.toString();
  const path = qs ? `/api/tasks?${qs}` : `/api/tasks`;
  return apiFetch<{ tasks: TaskDto[] }>(path, {
    method: "GET",
  });
}

export async function updateTask(
  id: string,
  payload: Partial<Pick<TaskDto, "status" | "title" | "description" | "dueAt">>
): Promise<TaskDto> {
  return apiFetch<TaskDto>(
    `/api/tasks/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

// ---------------------------------------------------------------------------
// Calls + dispositions + coaching
// ---------------------------------------------------------------------------

export type CallDirection = "INBOUND" | "OUTBOUND";
export type CallPurpose =
  | "EDUCATION"
  | "MARKETING"
  | "ENROLLMENT"
  | "SERVICE";

export type CallStatus =
  | "INITIATED"
  | "RINGING"
  | "CONNECTED"
  | "FAILED"
  | "COMPLETED"
  | "ABANDONED";

export interface CallSessionDto {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string;
  dialerIntegrationId: string | null;
  externalCallId: string | null;
  direction: CallDirection;
  purpose: CallPurpose;
  status: CallStatus;
  complianceState: string;
  startedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  recordingUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function createCall(payload: {
  leadId: string;
  direction: CallDirection;
  purpose: CallPurpose;
  status: CallStatus;
}): Promise<CallSessionDto> {
  return apiFetch<CallSessionDto>("/api/calls", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCalls(params: {
  leadId?: string;
  limit?: number;
}): Promise<{ calls: CallSessionDto[] }> {
  const query = new URLSearchParams();
  if (params.leadId) query.set("leadId", params.leadId);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const path = qs ? `/api/calls?${qs}` : `/api/calls`;
  return apiFetch<{ calls: CallSessionDto[] }>(path, {
    method: "GET",
  });
}

export async function getCallById(
  id: string
): Promise<CallSessionDto> {
  return apiFetch<CallSessionDto>(
    `/api/calls/${encodeURIComponent(id)}`,
    {
      method: "GET",
    }
  );
}

export async function setCallDisposition(
  callId: string,
  payload: {
    disposition:
      | "NO_ANSWER"
      | "LEFT_VOICEMAIL"
      | "CALLBACK"
      | "NOT_INTERESTED"
      | "QUALIFIED"
      | "TRANSFERRED"
      | "INVALID_NUMBER"
      | "OTHER";
    callbackAt?: string | null;
    notes?: string | null;
  }
): Promise<{
  callId: string;
  disposition: string;
  callbackAt: string | null;
  createdTaskId: string | null;
  newLeadStatus: LeadStatus | null;
}> {
  return apiFetch<{
    callId: string;
    disposition: string;
    callbackAt: string | null;
    createdTaskId: string | null;
    newLeadStatus: LeadStatus | null;
  }>(`/api/calls/${encodeURIComponent(callId)}/disposition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Coaching notes for a call

export interface CallCoachingNote {
  id: string;
  callId: string;
  score: number | null;
  notes: string;
  createdAt: string;
  coachUserId: string | null;
  coachName: string | null;
  coachEmail: string | null;
}

export async function addCallCoachingNote(payload: {
  callId: string;
  score?: number | null;
  notes: string;
}): Promise<CallCoachingNote> {
  const { callId, ...rest } = payload;
  return apiFetch<CallCoachingNote>(
    `/api/calls/${encodeURIComponent(callId)}/coaching`,
    {
      method: "POST",
      body: JSON.stringify(rest),
    }
  );
}

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

// ---------------------------------------------------------------------------
// Call Scripts
// ---------------------------------------------------------------------------

export type ScriptRunStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ABANDONED";

export interface CallScriptNodeOption {
  id: string;
  label: string;
  nextNodeId: string | null;
}

export interface CallScriptNode {
  id: string;
  label: string | null;
  content: string;
  isTerminal: boolean;
  options: CallScriptNodeOption[];
}

export interface CallScript {
  id: string;
  name: string;
  purpose: string;
  description: string | null;
  isActive: boolean;
  entryNodeId: string | null;
  nodes: CallScriptNode[];
}

export interface CallScriptRunSummary {
  id: string;
  scriptId: string;
  scriptName: string;
  purpose: string;
  status: ScriptRunStatus;
  outcome: string | null;
  startedAt: string;
  endedAt: string | null;
  agentId: string;
}

export async function getCallScripts(params?: {
  purpose?: string;
}): Promise<{ scripts: CallScript[] }> {
  const query = new URLSearchParams();
  if (params?.purpose) query.set("purpose", params.purpose);
  const qs = query.toString();
  const path = qs ? `/api/call-scripts?${qs}` : `/api/call-scripts`;
  return apiFetch<{ scripts: CallScript[] }>(path, {
    method: "GET",
  });
}

/**
 * Admin/inspection helper: fetch a single script by id.
 */
export async function getCallScriptById(
  scriptId: string
): Promise<{ script: CallScript }> {
  return apiFetch<{ script: CallScript }>(
    `/api/call-scripts/${encodeURIComponent(scriptId)}`,
    {
      method: "GET",
    }
  );
}

export async function startCallScriptRun(payload: {
  leadId: string;
  scriptId?: string;
  purpose?: string;
}): Promise<{
  runId: string;
  script: CallScript;
  currentNode: CallScriptNode | null;
}> {
  return apiFetch<{
    runId: string;
    script: CallScript;
    currentNode: CallScriptNode | null;
  }>("/api/call-scripts/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function stepCallScriptRun(
  runId: string,
  optionId: string
): Promise<{
  runId: string;
  status: ScriptRunStatus;
  currentNode: CallScriptNode | null;
}> {
  return apiFetch<{
    runId: string;
    status: ScriptRunStatus;
    currentNode: CallScriptNode | null;
  }>(`/api/call-scripts/runs/${encodeURIComponent(
    runId
  )}/step`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
}

export async function endCallScriptRun(payload: {
  runId: string;
  status?: ScriptRunStatus;
  outcome?: string | null;
}): Promise<{ success: boolean }> {
  const { runId, ...rest } = payload;
  return apiFetch<{ success: boolean }>(
    `/api/call-scripts/runs/${encodeURIComponent(runId)}/end`,
    {
      method: "POST",
      body: JSON.stringify(rest),
    }
  );
}

export async function getCallScriptRunsForLead(
  leadId: string
): Promise<{ runs: CallScriptRunSummary[] }> {
  return apiFetch<{ runs: CallScriptRunSummary[] }>(
    `/api/call-scripts/leads/${encodeURIComponent(leadId)}/runs`,
    {
      method: "GET",
    }
  );
}

/**
 * Seed the Medicare T65 demo script into the current user's organization.
 * Idempotent: backend will return existing script if present.
 */
export async function seedDemoCallScriptForOrg(): Promise<CallScript> {
  const res = await apiFetch<{ script: CallScript }>(
    "/api/call-scripts/seed-demo",
    {
      method: "POST",
    }
  );
  return res.script;
}

// ---------------------------------------------------------------------------
// Compliance: pre-call + history
// ---------------------------------------------------------------------------

export type CallPurposeCompliance =
  | "EDUCATION"
  | "MARKETING"
  | "ENROLLMENT"
  | "SERVICE";

export interface PreCallComplianceResult {
  status: "PASS" | "FAIL" | string;
  overallStatus?: string;
  summary?: string;
  [key: string]: any;
}

export async function runPreCallCheck(payload: {
  leadId: string;
  purpose: CallPurposeCompliance;
  callSessionId?: string | null;
}): Promise<PreCallComplianceResult> {
  return apiFetch<PreCallComplianceResult>(
    "/api/compliance/pre-call-check",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// Compliance history per lead

export interface ComplianceHistoryItem {
  id: string;
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL" | string;
  result: any;
  createdAt: string;
}

export async function getComplianceHistory(
  leadId: string
): Promise<{ history: ComplianceHistoryItem[] }> {
  return apiFetch<{ history: ComplianceHistoryItem[] }>(
    `/api/compliance/history/${encodeURIComponent(leadId)}`,
    {
      method: "GET",
    }
  );
}

// ---------------------------------------------------------------------------
// Audit / activity timeline
// ---------------------------------------------------------------------------

export interface AuditEventDto {
  id: string;
  eventType: string;
  createdAt: string;
  actor?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  metadata?: any;
}

export async function getAuditEvents(
  leadId: string
): Promise<{ events: AuditEventDto[]; nextCursor?: string | null }> {
  return apiFetch<{ events: AuditEventDto[]; nextCursor?: string | null }>(
    `/api/audit/${encodeURIComponent(leadId)}`,
    {
      method: "GET",
    }
  );
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export type EnrollmentStage =
  | "NOT_STARTED"
  | "DISCOVERY"
  | "PLAN_SELECTION"
  | "APPLICATION_SUBMITTED"
  | "ENROLLED"
  | "WITHDRAWN";

export interface Enrollment {
  id: string;
  leadId: string;
  stage: EnrollmentStage;
  notes: string | null;
  carrier?: string | null;
  planName?: string | null;
  externalEnrollmentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getEnrollmentForLead(
  leadId: string
): Promise<Enrollment | null> {
  const res = await apiFetch<{ enrollment: Enrollment | null }>(
    `/api/enrollment/leads/${encodeURIComponent(leadId)}`,
    {
      method: "GET",
    }
  );
  return res.enrollment ?? null;
}

export async function upsertEnrollmentForLead(payload: {
  leadId: string;
  stage: EnrollmentStage;
  notes?: string | null;
  carrier?: string | null;
  planName?: string | null;
  externalEnrollmentId?: string | null;
}): Promise<Enrollment> {
  return apiFetch<Enrollment>(
    `/api/enrollment/leads/${encodeURIComponent(payload.leadId)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// ---------------------------------------------------------------------------
// Notes (internal per lead)
// ---------------------------------------------------------------------------

export type LeadNote = {
  id: string;
  leadId: string;
  body: string;
  createdAt: string;
  authorUserId: string;
  authorName: string | null;
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

export async function addLeadNote(payload: {
  leadId: string;
  body: string;
}): Promise<LeadNote> {
  const { leadId, body } = payload;
  return apiFetch<LeadNote>(
    `/api/notes/${encodeURIComponent(leadId)}`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );
}

// Alias to keep older code happy (NotesPanel imports createLeadNote)
export async function createLeadNote(payload: {
  leadId: string;
  body: string;
}): Promise<LeadNote> {
  return addLeadNote(payload);
}

// ---------------------------------------------------------------------------
// Dashboard / Reports
// ---------------------------------------------------------------------------

export type DashboardRole =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE"
  | "READ_ONLY";

export interface AgentDashboardCards {
  leadsNeedingAttention: { count: number };
  tasksDueTodayOrOverdue: { count: number };
  recentComplianceFailures: {
    items: {
      id: string;
      leadId: string;
      purpose: string;
      createdAt: string;
    }[];
  };
  recentScriptRuns: {
    items: {
      id: string;
      leadId: string;
      status: string;
      outcome: string | null;
      startedAt: string;
    }[];
  };
  recentCalls: {
    items: {
      id: string;
      leadId: string;
      direction: string;
      purpose: string;
      status: string;
      startedAt: string;
    }[];
  };
  coachingSummary: {
    coachedCallCount: number;
    avgScore: number | null;
  };
}

export interface ManagerAdminDashboardCards {
  teamComplianceSummary: {
    totalChecks: number;
    passCount: number;
    failCount: number;
    passRate: number;
  };
  overdueTasks: {
    count: number;
  };
  leadDistributionByStatus: {
    status: string;
    count: number;
  }[];
  highRiskLeads: {
    items: {
      leadId: string;
      failCount: number;
    }[];
  };
  recentLeadImports: {
    items: {
      id: string;
      createdAt: string;
      totalRows: number;
      insertedCount: number;
      duplicateCount: number;
      errorCount: number;
      label: string | null;
      source: string | null;
    }[];
  };
  recentCalls: {
    items: {
      id: string;
      leadId: string;
      agentId: string;
      direction: string;
      purpose: string;
      status: string;
      startedAt: string;
    }[];
  };
  callVolumeByAgent: {
    items: {
      agentId: string;
      callCount: number;
    }[];
  };
  coachingSummary: {
    coachedCallCount: number;
    avgScore: number | null;
  };
  coachingByAgent: {
    items: {
      agentId: string;
      coachedCallCount: number;
      avgScore: number | null;
    }[];
  };
}

export type DashboardData =
  | { role: "AGENT"; cards: AgentDashboardCards }
  | {
      role: "MANAGER" | "ADMIN" | "DIRECTOR";
      cards: ManagerAdminDashboardCards;
    };

export interface DashboardResponse {
  dashboard: DashboardData;
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await apiFetch<DashboardResponse>("/api/dashboard", {
    method: "GET",
  });
  return res.dashboard;
}

// ---------------------------------------------------------------------------
// Compliance admin / reports for Admin page
// ---------------------------------------------------------------------------

type ComplianceAdminFilter = { from?: string; to?: string };

/**
 * Compliance summary for Admin page.
 * Backend: /api/compliance/admin/summary?from=...&to=...
 */
export async function getComplianceSummary(
  params?: ComplianceAdminFilter
): Promise<any> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  const path = qs
    ? `/api/compliance/admin/summary?${qs}`
    : `/api/compliance/admin/summary`;

  return apiFetch<any>(path, { method: "GET" });
}

/**
 * Compliance stats by agent for Admin page.
 * Backend: /api/compliance/admin/stats-by-agent?from=...&to=...
 */
export async function getComplianceStatsByAgent(
  params?: ComplianceAdminFilter
): Promise<any> {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  const path = qs
    ? `/api/compliance/admin/by-agent?${qs}`
    : `/api/compliance/admin/by-agent`;

  return apiFetch<any>(path, { method: "GET" });
}

/**
 * Recent compliance failures (org-wide or team-scoped) for Admin page.
 */
export async function getRecentComplianceFailures(
  limit: number = 20,
  params?: ComplianceAdminFilter
): Promise<any> {
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString();
  const path = qs
    ? `/api/compliance/admin/recent-failures?${qs}`
    : `/api/compliance/admin/recent-failures`;

  return apiFetch<any>(path, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Admin: lead imports + users
// ---------------------------------------------------------------------------

// Shapes based on Admin.tsx usage
export interface LeadCsvImportSummary {
  jobId: string;
  filename: string | null;
  source: string | null;
  totalRows: number;
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
}

export interface LeadImportJobSummary {
  id: string;
  filename: string | null;
  source: string | null;
  totalRows: number;
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

/**
 * Upload lead import CSV for Admin page.
 * Frontend parses the CSV and sends rows to /api/lead-import/manual.
 *
 * Expected headers (case-insensitive):
 *  firstName, lastName, phone, email?, state?, source?
 */
export async function uploadLeadImportCsv(
  file: File,
  options?: { label?: string; source?: string }
): Promise<LeadCsvImportSummary> {
  const text = await file.text();

  // Very simple CSV parser: split on newlines, then commas.
  // This assumes no embedded commas/quotes – fine for a pilot tool.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row.");
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());

  function idx(name: string): number {
    return header.indexOf(name.toLowerCase());
  }

  const idxFirstName = idx("firstname");
  const idxLastName = idx("lastname");
  const idxPhone = idx("phone");
  const idxEmail = idx("email");
  const idxState = idx("state");
  const idxSource = idx("source");

  if (idxPhone === -1) {
    throw new Error("CSV must include a 'phone' column.");
  }

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const firstName =
      idxFirstName >= 0 ? cols[idxFirstName] ?? "" : "";
    const lastName =
      idxLastName >= 0 ? cols[idxLastName] ?? "" : "";
    const name = `${firstName} ${lastName}`.trim() || "Unknown";

    const phone = cols[idxPhone] ?? "";
    const email =
      idxEmail >= 0 ? cols[idxEmail] || null : null;
    const state =
      idxState >= 0 ? cols[idxState] || null : null;
    const source =
      (idxSource >= 0 ? cols[idxSource] : options?.source) ??
      "CSV_IMPORT";

    return {
      name,
      phone,
      source,
      email,
      state,
    };
  });

  const payload = {
    rows,
    label: options?.label ?? options?.source ?? null,
  };

  return apiFetch<LeadCsvImportSummary>("/api/lead-import/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Recent lead imports for the Admin page.
 * Backend route does not exist yet; we return an empty list for now.
 * Admin UI will show "No import jobs found yet."
 */
export async function getRecentLeadImports(
  _limit?: number
): Promise<{ jobs: LeadImportJobSummary[] }> {
  return { jobs: [] };
}

export async function getRecentLeadImportsRaw(): Promise<any> {
  // kept only if some old code uses it; otherwise can be removed
  return apiFetch<any>("/api/lead-import/recent", {
    method: "GET",
  });
}

/**
 * Admin view of users in the org.
 * Backend: /api/admin/users
 */
export async function getUsersAdmin(): Promise<any> {
  return apiFetch<any>("/api/admin/users", {
    method: "GET",
  });
}

/**
 * Admin update for a user (role, managerId, directorId, etc.).
 * Backend: /api/admin/users/:id
 */
export async function updateUserAdmin(
  userId: string,
  payload: any
): Promise<any> {
  return apiFetch<any>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Admin create user.
 * Backend: POST /api/admin/users
 */
export async function createUserAdmin(payload: any): Promise<any> {
  return apiFetch<any>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Work queue (minimal stub, for /work page if needed)
// ---------------------------------------------------------------------------

export interface WorkItem {
  id: string;
  type: string; // LEAD / TASK / CALL / etc.
  leadId?: string | null;
  taskId?: string | null;
  createdAt: string;
}

export async function getWorkQueue(): Promise<{
  items: WorkItem[];
}> {
  return apiFetch<{ items: WorkItem[] }>("/api/work/queue", {
    method: "GET",
  });
}

