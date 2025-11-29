// apps/api/src/modules/leads/service.ts

import { prisma } from "../../db/client";
import {
  LeadStatus,
  LeadListResponseDto,
  LeadListItemDto,
  LeadDetailDto,
  UpdateLeadRequestDto,
} from "@elysium-crm/shared-types";

export interface ListLeadsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus | "ALL";
}

/**
 * Map a Lead Prisma record into a LeadListItemDto.
 * This version does NOT assume any relations are present,
 * so assignedToName is left as null for now.
 */
function mapLeadToListItem(lead: any): LeadListItemDto {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    state: lead.state ?? null,
    status: lead.status as LeadStatus,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    assignedToName: null, // TODO: map from relation if/when you expose it
  };
}

/**
 * Map a Lead Prisma record into a LeadDetailDto.
 */
function mapLeadToDetail(lead: any): LeadDetailDto {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    state: lead.state ?? null,
    zip: lead.zip ?? null,
    status: lead.status as LeadStatus,
    notes: lead.notes ?? null,
    timezone: lead.timezone ?? null,
    permissionToContactPhone: !!lead.permissionToContactPhone,
    doNotContact: !!lead.doNotContact,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    assignedToId: lead.assignedToId ?? null,
    assignedToName: null, // TODO: map from relation if/when you expose it
  };
}

/**
 * List leads for a given organization with basic pagination and filtering.
 */
export async function listLeads(
  organizationId: string,
  params: ListLeadsParams
): Promise<LeadListResponseDto> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize =
    params.pageSize && params.pageSize > 0 ? params.pageSize : 25;

  const where: any = {
    organizationId,
  };

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  }

  if (params.search) {
    const search = params.search.trim();
    if (search.length > 0) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  const items: LeadListItemDto[] = leads.map(mapLeadToListItem);

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Get a single lead by id for a given organization.
 */
export async function getLeadById(
  organizationId: string,
  leadId: string
): Promise<LeadDetailDto> {
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      organizationId,
    },
  });

  if (!lead) {
    const error: any = new Error("Lead not found");
    error.status = 404;
    throw error;
  }

  return mapLeadToDetail(lead);
}

/**
 * Update a lead and return the updated detail.
 */
export async function updateLead(
  organizationId: string,
  leadId: string,
  payload: UpdateLeadRequestDto
): Promise<LeadDetailDto> {
  // Ensure the lead belongs to this organization
  const existing = await prisma.lead.findFirst({
    where: {
      id: leadId,
      organizationId,
    },
  });

  if (!existing) {
    const error: any = new Error("Lead not found");
    error.status = 404;
    throw error;
  }

  const updateData: any = {};

  if (payload.firstName !== undefined) updateData.firstName = payload.firstName;
  if (payload.lastName !== undefined) updateData.lastName = payload.lastName;
  if (payload.email !== undefined) updateData.email = payload.email;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.state !== undefined) updateData.state = payload.state;
  if (payload.zip !== undefined) updateData.zip = payload.zip;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.notes !== undefined) updateData.notes = payload.notes;
  if (payload.timezone !== undefined) updateData.timezone = payload.timezone;
  if (payload.permissionToContactPhone !== undefined) {
    updateData.permissionToContactPhone = payload.permissionToContactPhone;
  }
  if (payload.doNotContact !== undefined) {
    updateData.doNotContact = payload.doNotContact;
  }
  if (payload.assignedToId !== undefined) {
    updateData.assignedToId = payload.assignedToId;
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: updateData,
  });

  return mapLeadToDetail(lead);
}

