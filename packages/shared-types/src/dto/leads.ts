import { LeadSource, LeadStatus } from '../enums';

export interface LeadDTO {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phonePrimary: string;
  phoneAlt?: string | null;
  email?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
  timeZone: string;
  leadSource: LeadSource;
  permissionToContactPhone: boolean;
  permissionToContactEmail: boolean;
  permissionSource: string;
  permissionCapturedAt?: string | null;
  status: LeadStatus;
  assignedToUserId?: string | null;
  notesSummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadDTO {
  organizationId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phonePrimary: string;
  phoneAlt?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  timeZone: string;
  leadSource: LeadSource;
  permissionToContactPhone: boolean;
  permissionToContactEmail: boolean;
  permissionSource: string;
  permissionCapturedAt?: string;
  status: LeadStatus;
  assignedToUserId?: string;
  notesSummary?: string;
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {}
