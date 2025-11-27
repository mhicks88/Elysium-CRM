import { EnrollmentStatus, EnrollmentVerificationMethod, EnrollmentVerificationOutcome } from '../enums';

export interface EnrollmentDTO {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string;
  callSessionId?: string | null;
  planNameOrId: string;
  effectiveDate: string;
  status: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentVerificationDTO {
  id: string;
  enrollmentId: string;
  method: EnrollmentVerificationMethod;
  contactDetail: string;
  initiatedAt: string;
  completedAt?: string | null;
  outcome: EnrollmentVerificationOutcome;
  notes?: string | null;
  createdAt: string;
}
