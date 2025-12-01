// apps/api/src/modules/leads/service.ts

import { prisma } from "../../db/client";
import {
  LeadStatus,
  LeadListResponseDto,
  LeadListItemDto,
  LeadDetailDto,
  UpdateLeadRequestDto,
  CreateLeadRequestDto,
} from "@elysium-crm/shared-types";
import type { Lead, Prisma } from "@prisma/client";

export interface ListLeadsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus | "ALL";
}

/**
 * Map a Prisma Lead record into a LeadListItemDto.
 */
function mapLeadToListItem(lead: Lead): LeadListItemDto {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? null,
    phone: lead.phonePrimary ?? lead.phoneAlt ?? null,
    state: lead.state ?? null,
    status: lead.status as LeadStatus,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    assignedToName: null, // TODO: map from lead.assignedTo when we include that relation
  };
}

/**
 * Map a Prisma Lead record into a LeadDetailDto.
 */
function mapLeadToDetail(lead: Lead): LeadDetailDto {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? null,
    phone: lead.phonePrimary ?? lead.phoneAlt ?? null,
    state: lead.state ?? null,
    zip: lead.zip ?? null,
    status: lead.status as LeadStatus,
    notes: lead.notesSummary ?? null,
    timezone: lead.timeZone ?? null,
    permissionToContactPhone: !!lead.permissionToContactPhone,
    doNotContact: lead.status === "DO_NOT_CONTACT",
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    assignedToId: lead.assignedToUserId ?? null,
    assignedToName: null, // TODO: map from relation when needed
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

  const where: Prisma.LeadWhereInput = {
    organizationId,
  };

  if (params.status && params.status !== "ALL") {
    where.status = params.status as any;
  }

  if (params.search) {
    const search = params.search.trim();
    if (search.length > 0) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phonePrimary: { contains: search, mode: "insensitive" } },
        { phoneAlt: { contains: search, mode: "insensitive" } },
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
 * Create a new lead and return the detail DTO.
 */
export async function createLead(
  organizationId: string,
  payload: CreateLeadRequestDto
): Promise<LeadDetailDto> {
  const now = new Date();

  const createData: Prisma.LeadUncheckedCreateInput = {
    organizationId,
    firstName: payload.firstName,
    lastName: payload.lastName,

    // TODO: wire this to real DOB once the UI collects it
    dateOfBirth: new Date("1900-01-01T00:00:00.000Z"),

    phonePrimary: payload.phone,
    phoneAlt: null,
    email: payload.email ?? null,

    // These are required at DB level; we currently don't collect them in UI.
    addressLine1: "Unknown",
    addressLine2: null,
    city: "Unknown",
    state: payload.state ?? "Unknown",
    zip: payload.zip ?? "",
    timeZone: payload.timezone ?? "America/New_York",

    leadSource: "OTHER" as any,
    permissionToContactPhone: payload.permissionToContactPhone ?? false,
    permissionToContactEmail: false,
    permissionSource: "MANUAL_ENTRY",
    permissionCapturedAt:
      payload.permissionToContactPhone === true ? now : null,

    // Prisma ENUM type, using string literal with cast:
    status:
      (payload.doNotContact === true
        ? "DO_NOT_CONTACT"
        : "NEW") as Prisma.LeadUncheckedCreateInput["status"],

    assignedToUserId: payload.assignedToId ?? null,
    notesSummary: payload.notes ?? null,

    createdAt: now,
    updatedAt: now,
  };

  const lead = await prisma.lead.create({
    data: createData,
  });

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

  const updateData: Prisma.LeadUncheckedUpdateInput = {};

  if (payload.firstName !== undefined) {
    updateData.firstName = payload.firstName;
  }

  if (payload.lastName !== undefined) {
    updateData.lastName = payload.lastName;
  }

  if (payload.email !== undefined) {
    updateData.email = payload.email;
  }

  if (payload.phone !== undefined) {
    if (payload.phone === null) {
      updateData.phonePrimary = existing.phonePrimary;
    } else {
      updateData.phonePrimary = payload.phone;
    }
  }

  if (payload.state !== undefined) {
    if (payload.state === null) {
      updateData.state = existing.state;
    } else {
      updateData.state = payload.state;
    }
  }

  if (payload.zip !== undefined) {
    if (payload.zip === null) {
      updateData.zip = existing.zip;
    } else {
      updateData.zip = payload.zip;
    }
  }

  if (payload.notes !== undefined) {
    updateData.notesSummary = payload.notes;
  }

  if (payload.timezone !== undefined) {
    if (payload.timezone === null) {
      updateData.timeZone = existing.timeZone;
    } else {
      updateData.timeZone = payload.timezone;
    }
  }

  if (payload.permissionToContactPhone !== undefined) {
    updateData.permissionToContactPhone = payload.permissionToContactPhone;
  }

  if (payload.assignedToId !== undefined) {
    updateData.assignedToUserId = payload.assignedToId;
  }

  if (payload.status !== undefined) {
    updateData.status = payload.status as any;
  } else if (payload.doNotContact !== undefined) {
    if (payload.doNotContact && existing.status !== "DO_NOT_CONTACT") {
      updateData.status = "DO_NOT_CONTACT";
    }
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: updateData,
  });

  return mapLeadToDetail(lead);
}

