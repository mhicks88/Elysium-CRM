// packages/shared-types/src/dto/lead.ts

import { LeadStatus } from "../enums";

export interface LeadListItemDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  assignedToName: string | null;
}

export interface LeadListResponseDto {
  items: LeadListItemDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LeadDetailDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  zip: string | null;
  status: LeadStatus;
  notes: string | null;
  timezone: string | null;
  permissionToContactPhone: boolean;
  doNotContact: boolean;
  createdAt: string;
  updatedAt: string;
  assignedToId: string | null;
  assignedToName: string | null;
}

export interface UpdateLeadRequestDto {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  zip?: string | null;
  status?: LeadStatus;
  notes?: string | null;
  timezone?: string | null;
  permissionToContactPhone?: boolean;
  doNotContact?: boolean;
  assignedToId?: string | null;
}

/**
 * Payload for creating a new lead.
 * 
 * This is intentionally a bit slimmer than the full Lead domain model.
 * The API will fill in required-but-not-yet-collected fields with
 * safe defaults (leadSource, permissionSource, address, etc.).
 */
export interface CreateLeadRequestDto {
  firstName: string;
  lastName: string;
  phone: string;

  email?: string | null;
  state?: string | null;
  zip?: string | null;
  timezone?: string | null;
  notes?: string | null;
  permissionToContactPhone?: boolean;
  doNotContact?: boolean;
  assignedToId?: string | null;
}

