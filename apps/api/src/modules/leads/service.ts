import { Prisma } from "@prisma/client";
import {
  LeadDetailDto,
  LeadListItemDto,
  LeadListResponseDto,
  LeadStatus,
  UpdateLeadRequestDto,
} from "@elysium-crm/shared-types/dto/lead";

import { prisma } from "../../db/client";

export interface ListLeadsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus | "ALL";
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const mapLeadListItem = (lead: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phonePrimary: string;
  state: string;
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: { firstName: string; lastName: string } | null;
}): LeadListItemDto => ({
  id: lead.id,
  firstName: lead.firstName,
  lastName: lead.lastName,
  email: lead.email ?? null,
  phone: lead.phonePrimary ?? null,
  state: lead.state ?? null,
  status: lead.status,
  createdAt: lead.createdAt.toISOString(),
  updatedAt: lead.updatedAt.toISOString(),
  assignedToName: lead.assignedTo
    ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
    : null,
});

const mapLeadDetail = (lead: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phonePrimary: string;
  state: string;
  zip: string;
  status: LeadStatus;
  notesSummary: string | null;
  timeZone: string;
  permissionToContactPhone: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignedToUserId: string | null;
  assignedTo: { firstName: string; lastName: string } | null;
}): LeadDetailDto => ({
  id: lead.id,
  firstName: lead.firstName,
  lastName: lead.lastName,
  email: lead.email ?? null,
  phone: lead.phonePrimary ?? null,
  state: lead.state ?? null,
  zip: lead.zip ?? null,
  status: lead.status,
  notes: lead.notesSummary ?? null,
  timezone: lead.timeZone ?? null,
  permissionToContactPhone: lead.permissionToContactPhone,
  doNotContact: lead.status === LeadStatus.DO_NOT_CONTACT,
  createdAt: lead.createdAt.toISOString(),
  updatedAt: lead.updatedAt.toISOString(),
  assignedToId: lead.assignedToUserId,
  assignedToName: lead.assignedTo
    ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
    : null,
});

export async function listLeads(
  orgId: string,
  params: ListLeadsParams,
): Promise<LeadListResponseDto> {
  const page = Math.max(1, params.page ?? 1);
  const rawPageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, rawPageSize), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const where: Prisma.LeadWhereInput = { organizationId: orgId };

  if (params.status && params.status !== "ALL") {
    where.status = params.status as any;
  }

  if (params.search) {
    const term = params.search.trim();
    if (term.length > 0) {
      where.OR = [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phonePrimary: { contains: term, mode: "insensitive" } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        assignedTo: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    items: items.map(mapLeadListItem),
    page,
    pageSize,
    total,
  };
}

export async function getLeadById(
  orgId: string,
  leadId: string,
): Promise<LeadDetailDto> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    include: {
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });

  if (!lead) {
    const error = new Error("Lead not found");
    (error as any).status = 404;
    throw error;
  }

  return mapLeadDetail(lead as any);
}

export async function updateLead(
  orgId: string,
  leadId: string,
  payload: UpdateLeadRequestDto,
): Promise<LeadDetailDto> {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
  });

  if (!existing) {
    const error = new Error("Lead not found");
    (error as any).status = 404;
    throw error;
  }

  const data: Prisma.LeadUpdateInput = {};

  if (payload.firstName !== undefined) data.firstName = payload.firstName;
  if (payload.lastName !== undefined) data.lastName = payload.lastName;
  if (payload.email !== undefined) data.email = payload.email;
  if (payload.phone !== undefined) data.phonePrimary = payload.phone;
  if (payload.state !== undefined) data.state = payload.state ?? existing.state;
  if (payload.zip !== undefined) data.zip = payload.zip ?? existing.zip;
  if (payload.notes !== undefined) data.notesSummary = payload.notes;
  if (payload.timezone !== undefined)
    data.timeZone = payload.timezone ?? existing.timeZone;
  if (payload.permissionToContactPhone !== undefined)
    data.permissionToContactPhone = payload.permissionToContactPhone;
  if (payload.assignedToId !== undefined)
    data.assignedTo = payload.assignedToId
      ? { connect: { id: payload.assignedToId } }
      : { disconnect: true };

  let nextStatus = payload.status ?? (existing.status as LeadStatus);
  if (payload.doNotContact === true) {
    nextStatus = LeadStatus.DO_NOT_CONTACT;
  }

  if (nextStatus !== undefined) {
    data.status = nextStatus as any;
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data,
    include: {
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });

  return mapLeadDetail(updated as any);
}
