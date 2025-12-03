// apps/api/src/modules/enrollment/types.ts

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
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for creating/updating enrollment.
 * In v1 we allow setting stage + notes.
 */
export interface UpsertEnrollmentInput {
  stage: EnrollmentStage;
  notes?: string | null;
}

