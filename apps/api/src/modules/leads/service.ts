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
import { recordAuditEvent } from "../audit/service";

export interface ListLeadsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus | "ALL";
}

export interface LeadImportSummary {
  jobId: string;
  filename: string | null;
  source: string | null;
  totalRows: number;
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
}

// Local extension to allow optional dateOfBirth even if the shared
// type doesn't know about it yet.
type CreateLeadWithDob = CreateLeadRequestDto & {
  dateOfBirth?: string | null;
};

// Lead with its assignee relation loaded
type LeadWithAssignee = Lead & {
  assignedTo?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
};

function buildAssignedToName(
  user:
    | {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      }
    | null
    | undefined
): string | null {
  if (!user) return null;
  const fullName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (user.email) return user.email;
  return user.id;
}

/**
 * Map a Prisma Lead record into a LeadListItemDto.
 */
function mapLeadToListItem(lead: LeadWithAssignee): LeadListItemDto {
  const assignedToName = buildAssignedToName(lead.assignedTo ?? null);

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
    assignedToName,
  };
}

/**
 * Map a Prisma Lead record into a LeadDetailDto.
 */
function mapLeadToDetail(lead: LeadWithAssignee): LeadDetailDto {
  const assignedToName = buildAssignedToName(lead.assignedTo ?? null);

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
    assignedToName,
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
    // Defensive trim + soft length cap
    const search = params.search.trim().slice(0, 200);
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
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const items: LeadListItemDto[] = leads.map((lead) =>
    mapLeadToListItem(lead as LeadWithAssignee)
  );

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
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!lead) {
    const error: any = new Error("Lead not found");
    error.status = 404;
    throw error;
  }

  return mapLeadToDetail(lead as LeadWithAssignee);
}

/**
 * Create a new lead and return the detail DTO.
 */
export async function createLead(
  organizationId: string,
  payload: CreateLeadWithDob
): Promise<LeadDetailDto> {
  const now = new Date();

  // Date of birth: allow ISO or YYYY-MM-DD; fall back to sentinel if invalid.
  const defaultDob = new Date("1900-01-01T00:00:00.000Z");
  let dob = defaultDob;
  if (payload.dateOfBirth) {
    const parsed = new Date(payload.dateOfBirth);
    if (!Number.isNaN(parsed.getTime())) {
      dob = parsed;
    }
  }

  const createData: Prisma.LeadUncheckedCreateInput = {
    organizationId,
    firstName: payload.firstName,
    lastName: payload.lastName,

    dateOfBirth: dob,

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

  // Newly created lead won't have the relation hydrated yet
  const withAssignee: LeadWithAssignee = {
    ...(lead as Lead),
    assignedTo: null,
  };

  return mapLeadToDetail(withAssignee);
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
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return mapLeadToDetail(lead as LeadWithAssignee);
}

/**
 * Very simple CSV line splitter.
 * This intentionally does NOT handle all edge cases (quoted commas, etc.)
 * but is fine for controlled internal lead files.
 */
function splitCsvLine(line: string): string[] {
  return line.split(",").map((part) => part.trim());
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^0-9]/g, "");
}

/**
 * Import leads from a CSV buffer.
 *
 * Expected columns (case-insensitive headers):
 *   firstName, lastName, phone, email, state, source
 *
 * Extra columns are preserved in rawData for auditing.
 */
export async function importLeadsFromCsv(params: {
  organizationId: string;
  userId: string;
  filename?: string | null;
  source?: string | null;
  csvBuffer: Buffer;
  defaultAssignedToUserId?: string | null;
}): Promise<LeadImportSummary> {
  const {
    organizationId,
    userId,
    filename = null,
    source = null,
    csvBuffer,
    defaultAssignedToUserId = null,
  } = params;

  const text = csvBuffer.toString("utf8");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    // Create an empty job just so there's a record of the attempt
    const emptyJob = await prisma.leadImportJob.create({
      data: {
        organizationId,
        createdByUserId: userId,
        source,
        filename,
        status: "COMPLETED",
        totalRows: 0,
        createdCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    await recordAuditEvent({
      userId,
      leadId: null,
      eventType: "LEAD_IMPORT_COMPLETED",
      eventData: {
        jobId: emptyJob.id,
        organizationId,
        filename,
        source,
        totalRows: 0,
        createdCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        note: "Empty file",
      },
    });

    return {
      jobId: emptyJob.id,
      filename,
      source,
      totalRows: 0,
      createdCount: 0,
      duplicateCount: 0,
      failedCount: 0,
    };
  }

  const headerLine = lines[0];
  const headerParts = splitCsvLine(headerLine);
  const headerIndex: Record<string, number> = {};
  headerParts.forEach((h, idx) => {
    headerIndex[normalizeHeader(h)] = idx;
  });

  function getField(rowParts: string[], key: string): string | null {
    const idx = headerIndex[normalizeHeader(key)];
    if (idx === undefined || idx < 0 || idx >= rowParts.length) return null;
    const value = rowParts[idx]?.trim();
    return value.length > 0 ? value : null;
  }

  const startedAt = new Date();

  const job = await prisma.leadImportJob.create({
    data: {
      organizationId,
      createdByUserId: userId,
      source,
      filename,
      status: "RUNNING",
      totalRows: 0,
      createdCount: 0,
      duplicateCount: 0,
      failedCount: 0,
      startedAt,
    },
  });

  let totalRows = 0;
  let createdCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  // Process each data line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1; // 1-based including header
    if (!line.trim()) continue;

    totalRows += 1;

    const rowParts = splitCsvLine(line);
    const rawRow: Record<string, any> = {};
    headerParts.forEach((h, idx) => {
      rawRow[h] = rowParts[idx] ?? "";
    });

    const firstName = getField(rowParts, "firstName");
    const lastName = getField(rowParts, "lastName");
    const phoneRaw = getField(rowParts, "phone");
    const email = getField(rowParts, "email");
    const state = getField(rowParts, "state") ?? "UNKNOWN";
    const rowSource = getField(rowParts, "source") ?? source ?? "LIST";

    const normalizedPhone = normalizePhone(phoneRaw);

    if (!firstName || !lastName || !normalizedPhone || !rowSource) {
      failedCount += 1;
      await prisma.leadImportRow.create({
        data: {
          jobId: job.id,
          rowNumber,
          rawData: rawRow,
          status: "FAILED",
          errorMessage:
            "Missing required fields (firstName, lastName, phone, source)",
          createdLeadId: null,
        },
      });
      continue;
    }

    // Deduplication by phone within this org
    const existing = await prisma.lead.findFirst({
      where: {
        organizationId,
        phonePrimary: normalizedPhone,
      },
    });

    if (existing) {
      duplicateCount += 1;
      await prisma.leadImportRow.create({
        data: {
          jobId: job.id,
          rowNumber,
          rawData: rawRow,
          status: "DUPLICATE",
          errorMessage: "Duplicate lead by primary phone",
          createdLeadId: existing.id,
        },
      });
      continue;
    }

    // Create the lead
    const now = new Date();

    const createdLead = await prisma.lead.create({
      data: {
        organizationId,
        firstName,
        lastName,
        dateOfBirth: new Date("1900-01-01T00:00:00.000Z"),
        phonePrimary: normalizedPhone,
        phoneAlt: null,
        email,
        addressLine1: "UNKNOWN",
        addressLine2: null,
        city: "UNKNOWN",
        state,
        zip: "00000",
        timeZone: "America/New_York",
        leadSource: "LIST",
        permissionToContactPhone: false,
        permissionToContactEmail: false,
        permissionSource: "IMPORT",
        permissionCapturedAt: null,
        status: "NEW",
        assignedToUserId: defaultAssignedToUserId ?? null,
        notesSummary: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    createdCount += 1;

    await prisma.leadImportRow.create({
      data: {
        jobId: job.id,
        rowNumber,
        rawData: rawRow,
        status: "CREATED",
        errorMessage: null,
        createdLeadId: createdLead.id,
      },
    });
  }

  const finishedAt = new Date();

  const updatedJob = await prisma.leadImportJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      totalRows,
      createdCount,
      duplicateCount,
      failedCount,
      finishedAt,
    },
  });

  await recordAuditEvent({
    userId,
    leadId: null,
    eventType: "LEAD_IMPORT_COMPLETED",
    eventData: {
      jobId: updatedJob.id,
      organizationId,
      filename,
      source,
      totalRows,
      createdCount,
      duplicateCount,
      failedCount,
    },
  });

  return {
    jobId: updatedJob.id,
    filename,
    source,
    totalRows,
    createdCount,
    duplicateCount,
    failedCount,
  };
}

