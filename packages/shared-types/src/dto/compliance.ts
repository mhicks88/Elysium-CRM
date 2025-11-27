import { ComplianceState } from '../enums';

export interface PreCallCheckResultDTO {
  status: 'PASS' | 'FAIL';
  reasons: string[];
  checkResults: Array<{
    id: string;
    checkType: string;
    status: string;
    details?: string | null;
    checkedAt: string;
  }>;
  complianceState?: ComplianceState;
}

export interface ScopeOfAppointmentDTO {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string;
  callSessionId?: string | null;
  appointmentDate: string;
  channel: string;
  productTypes: string[];
  statementAcknowledged: boolean;
  signatureMethod: string;
  signatureEvidenceUrl?: string | null;
  status: string;
  signedAt?: string | null;
  expiresAt?: string | null;
}

export interface ScriptDTO {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description?: string | null;
  category: string;
  applicableProductTypes?: string[];
  isActive: boolean;
}

export interface ScriptStepDTO {
  id: string;
  scriptId: string;
  order: number;
  key: string;
  content: string;
  isRequired: boolean;
}
