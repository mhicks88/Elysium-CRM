// apps/api/src/modules/leadImport/service.ts
//
// Core service for lead import / ingestion.
// This does NOT deal with multipart/form-data or file parsing directly.
// Instead, it expects normalized rows (e.g. parsed CSV/XLSX or API payload).
//
// Phase 1 goals:
// - Validate minimal required fields (name, phone, source)
// - Normalize phone
// - Deduplicate against existing leads (by org + phone)
// - Insert new leads with safe defaults for required DB fields
// - Emit an audit event summarizing the import

import { prisma } from "../../db/client";
import { recordAuditEvent } from "../audit/service";

export type RawImportedLeadRow = {
  name: string;            // full name, e.g. "Jane Doe"
  phone: string;           // raw phone string
  source: string;          // e.g. "WEB_FORM", "PARTNER_X"
  email?: string | null;
  state?: string | null;
  // extend as needed in later phases
};

export type NormalizedLeadRow = {
  firstName: string;
  lastName: string;
  phonePrimary: string;
  leadSource: string;
  email?: string | null;
  state?: string | null;
};

export type ImportSourceType = "MANUAL_UPLOAD" | "API_INGEST";

export interface LeadImportSummary {
  totalRows: number;
  validRows: number;
  insertedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: {
    rowIndex: number;
    message: string;
  }[];
}

/**
 * Normalize a phone number by stripping non-digits.
 * Very simple v1; can be replaced later with a real library.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D+/g, "");
}

/**
 * Try to split a full name into first + last.
 * If only one token, we treat it as firstName and use "Unknown" for lastName.
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "Unknown", lastName: "Unknown" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Unknown" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Normalize raw imported rows into a structure we can map to the DB.
 * Performs basic validation for required fields (name, phone, source).
 */
export function normalizeImportedRows(
  rawRows: RawImportedLeadRow[]
): {
  normalized: (NormalizedLeadRow | null)[];
  errors: { rowIndex: number; message: string }[];
} {
  const errors: { rowIndex: number; message: string }[] = [];
  const normalized: (NormalizedLeadRow | null)[] = rawRows.map((row, index) => {
    const name = row.name?.trim();
    const phone = row.phone?.trim();
    const source = row.source?.trim();

    if (!name) {
      errors.push({ rowIndex: index, message: "Missing name" });
      return null;
    }
    if (!phone) {
      errors.push({ rowIndex: index, message: "Missing phone" });
      return null;
    }
    if (!source) {
      errors.push({ rowIndex: index, message: "Missing source" });
      return null;
    }

    const { firstName, lastName } = splitName(name);
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      errors.push({ rowIndex: index, message: "Phone could not be normalized" });
      return null;
    }

    return {
      firstName,
      lastName,
      phonePrimary: normalizedPhone,
      leadSource: source,
      email: row.email ?? null,
      state: row.state ?? null,
    };
  });

  return { normalized, errors };
}

/**
 * Core import function.
 *
 * This function:
 *  - Validates & normalizes rows
 *  - Deduplicates against existing leads (by organizationId + phonePrimary)
 *  - Inserts new leads with safe defaults for required DB fields
 *  - Emits an audit event summarizing the import
 *
 * NOTE: We intentionally keep DB defaults simple for now:
 *  - dateOfBirth: 1900-01-01
 *  - address: "UNKNOWN"
 *  - timeZone: "America/New_York"
 *  - permissionToContactPhone / Email: false
 *  - permissionSource: "IMPORT"
 *  - status: "NEW"
 */
export async function importLeadsForOrganization(params: {
  organizationId: string;
  userId: string;
  rows: RawImportedLeadRow[];
  importSource: ImportSourceType;
  importLabel?: string; // e.g. "CSV Upload 2025-12-02"
}): Promise<LeadImportSummary> {
  const { organizationId, userId, rows, importSource, importLabel } = params;

  const totalRows = rows.length;

  // Step 1: validation + normalization
  const { normalized, errors: validationErrors } = normalizeImportedRows(rows);
  const validRows: NormalizedLeadRow[] = normalized.filter(
    (r): r is NormalizedLeadRow => r !== null
  );

  if (validRows.length === 0) {
    // Still record an audit event for the failed import attempt
    await recordAuditEvent({
      userId,
      leadId: null,
      eventType: "LEAD_IMPORT",
      eventData: {
        organizationId,
        importSource,
        importLabel: importLabel ?? null,
        totalRows,
        validRows: 0,
        insertedCount: 0,
        duplicateCount: 0,
        errorCount: validationErrors.length,
        errors: validationErrors,
      },
    });

    return {
      totalRows,
      validRows: 0,
      insertedCount: 0,
      duplicateCount: 0,
      errorCount: validationErrors.length,
      errors: validationErrors,
    };
  }

  // Step 2: dedupe by phonePrimary within this org.
  const phones = Array.from(
    new Set(validRows.map((r) => r.phonePrimary))
  );

  const existingLeads = await prisma.lead.findMany({
    where: {
      organizationId,
      phonePrimary: { in: phones },
    },
    select: {
      phonePrimary: true,
    },
  });

  const existingPhoneSet = new Set(
    existingLeads.map((l) => l.phonePrimary)
  );

  let insertedCount = 0;
  let duplicateCount = 0;
  const importErrors: { rowIndex: number; message: string }[] = [...validationErrors];

  // Step 3: insert non-duplicate leads with safe defaults
  for (let index = 0; index < validRows.length; index++) {
    const row = validRows[index];

    if (existingPhoneSet.has(row.phonePrimary)) {
      duplicateCount += 1;
      continue;
    }

    try {
      // Minimal safe defaults for required DB fields
      await prisma.lead.create({
        data: {
          organizationId,
          firstName: row.firstName,
          lastName: row.lastName,
          dateOfBirth: new Date("1900-01-01T00:00:00.000Z"),
          phonePrimary: row.phonePrimary,
          phoneAlt: null,
          email: row.email ?? null,
          addressLine1: "UNKNOWN",
          addressLine2: null,
          city: "UNKNOWN",
          state: row.state ?? "UNKNOWN",
          zip: "00000",
          timeZone: "America/New_York",
          leadSource: mapLeadSource(row.leadSource),
          permissionToContactPhone: false,
          permissionToContactEmail: false,
          permissionSource: "IMPORT",
          permissionCapturedAt: null,
          status: "NEW",
          assignedToUserId: null,
          notesSummary: null,
        },
      });

      insertedCount += 1;
    } catch (err: any) {
      importErrors.push({
        rowIndex: index,
        message: err?.message ?? "Failed to insert lead",
      });
    }
  }

  const errorCount = importErrors.length;

  // Step 4: audit event summarizing this import
  await recordAuditEvent({
    userId,
    leadId: null,
    eventType: "LEAD_IMPORT",
    eventData: {
      organizationId,
      importSource,
      importLabel: importLabel ?? null,
      totalRows,
      validRows: validRows.length,
      insertedCount,
      duplicateCount,
      errorCount,
      errors: importErrors,
    },
  });

  return {
    totalRows,
    validRows: validRows.length,
    insertedCount,
    duplicateCount,
    errorCount,
    errors: importErrors,
  };
}

/**
 * Map an arbitrary source string into the LeadSource enum used in Prisma.
 * We keep this loose for now; anything unrecognized becomes "OTHER".
 */
function mapLeadSource(source: string): any {
  const upper = source.trim().toUpperCase();

  // These should match your LeadSource enum in schema.prisma:
  // INBOUND_CALL, WEB_FORM, TRANSFER, LIST, REFERRAL, OTHER
  switch (upper) {
    case "INBOUND_CALL":
    case "INBOUND":
      return "INBOUND_CALL";
    case "WEB_FORM":
    case "WEB":
    case "ONLINE":
      return "WEB_FORM";
    case "TRANSFER":
      return "TRANSFER";
    case "LIST":
      return "LIST";
    case "REFERRAL":
      return "REFERRAL";
    default:
      return "OTHER";
  }
}

