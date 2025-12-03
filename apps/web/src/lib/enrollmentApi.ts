// apps/web/src/lib/enrollmentApi.ts

import { apiFetch } from "./apiClient";

export type EnrollmentStage =
  | "NOT_STARTED"
  | "DISCOVERY"
  | "UNDER_REVIEW"
  | "PENDING_DOCS"
  | "ENROLLED"
  | "WITHDRAWN";

export interface Enrollment {
  id: string;
  leadId: string;
  stage: EnrollmentStage;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEnrollmentInput {
  stage: EnrollmentStage;
  notes?: string | null;
}

/**
 * Fetch enrollment state for a given lead.
 *
 * Returns:
 * - Enrollment object if found
 * - null if 404 (no enrollment yet)
 * - throws on other errors
 */
export async function getEnrollmentForLead(
  leadId: string
): Promise<Enrollment | null> {
  try {
    const data = await apiFetch<Enrollment>(
      `/api/enrollment/${encodeURIComponent(leadId)}`,
      {
        method: "GET",
      }
    );
    return data;
  } catch (err: any) {
    const msg = err?.message ?? "Failed to fetch enrollment";
    // apiFetch throws on non-2xx; detect 404 from message text
    if (msg.includes("API error 404")) {
      return null;
    }
    throw new Error(msg);
  }
}

/**
 * Create or update enrollment for a given lead.
 */
export async function upsertEnrollmentForLead(
  leadId: string,
  input: UpsertEnrollmentInput
): Promise<Enrollment> {
  try {
    const data = await apiFetch<Enrollment>(
      `/api/enrollment/${encodeURIComponent(leadId)}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
    return data;
  } catch (err: any) {
    const msg = err?.message ?? "Failed to save enrollment";
    throw new Error(msg);
  }
}

