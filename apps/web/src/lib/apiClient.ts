// apps/web/src/lib/apiClient.ts

import type {
  LoginRequestDto,
  LoginResponseDto,
} from "@elysium-crm/shared-types/dto/auth";
import type {
  PreCallCheckResultDto,
  PlannedCallPurpose,
} from "@elysium-crm/shared-types/dto/compliance";
import type {
  LeadDetailDto,
  LeadListResponseDto,
  LeadStatus,
  UpdateLeadRequestDto,
  CreateLeadRequestDto,
} from "@elysium-crm/shared-types/dto/lead";
import { readStoredToken, clearStoredAuth } from "./auth";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = readStoredToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let body: any = null;

    try {
      body = await res.json();
      message =
        body?.error?.message ??
        body?.error ??
        body?.message ??
        message;
    } catch {
      // ignore JSON parse errors
    }

    // Auto-logout flow: only if we *had* a token (i.e. not a failed login)
    if (res.status === 401 && token) {
      clearStoredAuth();
      try {
        // Avoid redirect loops if somehow already on /login
        if (window.location.pathname !== "/login") {
          window.location.href = "/login?reason=session_expired";
        }
      } catch {
        // window might not exist in some environments; safe to ignore
      }
    }

    const error = new Error(message) as Error & { status?: number; data?: any };
    error.status = res.status;
    error.data = body ?? undefined;
    throw error;
  }

  // Some endpoints might return 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * Auth login
 */
export async function login(
  payload: LoginRequestDto
): Promise<LoginResponseDto> {
  return request<LoginResponseDto>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Compliance: run pre-call check
 */
export async function runPreCallCheck(params: {
  leadId: string;
  purpose: PlannedCallPurpose;
  callSessionId?: string;
}): Promise<PreCallCheckResultDto> {
  return request<PreCallCheckResultDto>("/api/compliance/pre-call-check", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Leads API helpers
 */
export async function getLeads(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus | "ALL";
}): Promise<LeadListResponseDto> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", String(params.page));
  if (params.pageSize) searchParams.append("pageSize", String(params.pageSize));
  if (params.search) searchParams.append("search", params.search);
  if (params.status) searchParams.append("status", params.status);

  const query = searchParams.toString();
  const url = query ? `/api/leads?${query}` : "/api/leads";

  return request<LeadListResponseDto>(url);
}

export async function getLeadById(id: string): Promise<LeadDetailDto> {
  return request<LeadDetailDto>(`/api/leads/${id}`);
}

export async function updateLead(
  id: string,
  payload: UpdateLeadRequestDto
): Promise<LeadDetailDto> {
  return request<LeadDetailDto>(`/api/leads/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createLead(
  payload: CreateLeadRequestDto
): Promise<LeadDetailDto> {
  return request<LeadDetailDto>("/api/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

