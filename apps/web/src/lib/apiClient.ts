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
  return apiFetch<{ events: any[] }>(`/api/audit/${leadId}`, {
    method: "GET",
  });
}

// -----------------------------------------------------------------------------
// COMPLIANCE HISTORY
// -----------------------------------------------------------------------------

export async function getComplianceHistory(leadId: string) {
  return apiFetch<{ history: any[] }>(`/api/compliance/history/${leadId}`, {
    method: "GET",
  });
}

