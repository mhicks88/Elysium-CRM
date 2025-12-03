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
      credentials: "include", // important: send refreshToken cookie
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
  auth?: boolean; // default true – whether to attach Authorization
};

export async function apiFetch<T = unknown>(
  input: string,
  init: ApiOptions = {}
): Promise<T> {
  const { auth = true, ...rest } = init;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(rest.headers || {}),
  };

  if (auth && accessToken) {
    (headers as any)["Authorization"] = `Bearer ${accessToken}`;
  }

  const url = buildUrl(input as string);

  const firstResponse = await fetch(url, {
    ...rest,
    headers,
    credentials: rest.credentials ?? "include", // send cookies by default
  });

  // If not an auth-protected route or response is ok, return directly
  if (!auth || firstResponse.status !== 401) {
    if (!firstResponse.ok) {
      const text = await firstResponse.text();
      throw new Error(
        `API error ${firstResponse.status}: ${text || firstResponse.statusText}`
      );
    }
    return (await firstResponse.json()) as T;
  }

  // 401 on an authenticated route → try to refresh token
  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) {
    // Hard logout path
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  // Retry original request with new token
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

  return (await retryResponse.json()) as T;
}

// -----------------------------------------------------------------------------
// AUTH
// -----------------------------------------------------------------------------

// Simple login helper used by src/routes/auth/index.tsx
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

// List leads
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

// Fetch single lead
export async function getLeadById(id: string) {
  return apiFetch<any>(`/api/leads/${id}`, { method: "GET" });
}

// Update lead
export async function updateLead(
  id: string,
  payload: Record<string, unknown>
) {
  return apiFetch<any>(`/api/leads/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Create lead
export async function createLead(payload: Record<string, unknown>) {
  return apiFetch<any>("/api/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// -----------------------------------------------------------------------------
// AUDIT LOG
// -----------------------------------------------------------------------------

export async function getAuditEvents(leadId: string) {
  // Backend now returns { events, nextCursor }, but the UI can ignore nextCursor for now.
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

/**
 * List active scripts for the current org.
 * Optional filter by purpose.
 */
export async function getCallScripts(purpose?: string) {
  const qs = purpose ? `?purpose=${encodeURIComponent(purpose)}` : "";
  return apiFetch<{ scripts: CallScript[] }>(
    `/api/call-scripts${qs}`,
    { method: "GET" }
  );
}

/**
 * Fetch a single script by id.
 */
export async function getCallScriptById(scriptId: string) {
  return apiFetch<{ script: CallScript }>(
    `/api/call-scripts/${encodeURIComponent(scriptId)}`,
    { method: "GET" }
  );
}

/**
 * Start a new script run for a lead.
 * Either pass scriptId, or purpose to auto-resolve the script.
 */
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

/**
 * Step a script run by selecting an optionId.
 */
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

/**
 * End a script run explicitly (e.g., agent abandons or completes with outcome).
 */
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

/**
 * Get recent script runs for a lead.
 */
export async function getCallScriptRunsForLead(leadId: string) {
  return apiFetch<{ runs: CallScriptRunSummary[] }>(
    `/api/call-scripts/leads/${encodeURIComponent(leadId)}/runs`,
    {
      method: "GET",
    }
  );
}

// -----------------------------------------------------------------------------
// LEAD IMPORT – NEW
// -----------------------------------------------------------------------------

export type LeadImportRow = {
  name: string;
  phone: string;
  source: string;
  email?: string | null;
  state?: string | null;
};

export type LeadImportSummary = {
  success: boolean;
  totalRows: number;
  validRows: number;
  insertedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: {
    rowIndex: number;
    message: string;
  }[];
};

/**
 * Run a manual lead import (ADMIN/MANAGER only).
 * Expects rows in the same RawImportedLeadRow shape used by the backend.
 */
export async function runManualLeadImport(
  rows: LeadImportRow[],
  label?: string
): Promise<LeadImportSummary> {
  return apiFetch<LeadImportSummary>("/api/lead-import/manual", {
    method: "POST",
    body: JSON.stringify({
      rows,
      label: label ?? undefined,
    }),
  });
}

// -----------------------------------------------------------------------------
// DASHBOARD
// -----------------------------------------------------------------------------

// Keep this loose for now; you can tighten types later using the server schema.
export type DashboardResponse = any;

/**
 * Get role-based dashboard data for the current user.
 */
export async function getDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/api/dashboard", {
    method: "GET",
  });
}

