import { CallDirection, CallPurpose, CallStatus, ComplianceState } from '../enums';

export interface CallSessionDTO {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string;
  dialerIntegrationId: string;
  externalCallId: string;
  direction: CallDirection;
  purpose: CallPurpose;
  status: CallStatus;
  complianceState: ComplianceState;
  startedAt: string;
  connectedAt?: string | null;
  endedAt?: string | null;
  recordingUrl?: string | null;
}
