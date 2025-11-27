import type {
  LoginRequestDto,
  LoginResponseDto,
} from "@elysium-crm/shared-types/dto/auth";
import type {
  PreCallCheckResultDto,
  PlannedCallPurpose,
} from "@elysium-crm/shared-types/dto/compliance";
import { readStoredToken } from "./auth";

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
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
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
 * Compliance: run pre-call check (placeholder for later)
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

