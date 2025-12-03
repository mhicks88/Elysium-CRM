// apps/api/src/modules/complianceHistory/service.ts
//
// DB-backed compliance history service using the ComplianceCheck model.

import { prisma } from "../../db/client";

export interface ComplianceCheckRecord {
  id: string;
  organizationId: string;
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  result: any;
  createdAt: Date;
}

/**
 * Record a compliance check in the database.
 *
 * We derive organizationId from the lead.
 */
export async function recordComplianceCheck(params: {
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL";
  result: any;
}): Promise<ComplianceCheckRecord> {
  const { leadId, userId, purpose, status, result } = params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, organizationId: true },
  });

  if (!lead) {
    throw new Error(`Lead not found for compliance check (leadId=${leadId})`);
  }

  const created = await prisma.complianceCheck.create({
    data: {
      organizationId: lead.organizationId,
      leadId: lead.id,
      userId,
      purpose,
      status,
      result,
    },
  });

  return {
    id: created.id,
    organizationId: created.organizationId,
    leadId: created.leadId,
    userId: created.userId,
    purpose: created.purpose,
    status: created.status as "PASS" | "FAIL" | "SKIPPED",
    result: created.result,
    createdAt: created.createdAt,
  };
}

/**
 * List compliance checks for a single lead.
 */
export async function listComplianceChecks(
  leadId: string
): Promise<ComplianceCheckRecord[]> {
  const rows = await prisma.complianceCheck.findMany({
    where: { leadId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((c) => ({
    id: c.id,
    organizationId: c.organizationId,
    leadId: c.leadId,
    userId: c.userId,
    purpose: c.purpose,
    status: c.status as "PASS" | "FAIL" | "SKIPPED",
    result: c.result,
    createdAt: c.createdAt,
  }));
}

/**
 * List all compliance checks (used by admin analytics).
 */
export async function listAllComplianceChecks(): Promise<
  ComplianceCheckRecord[]
> {
  const rows = await prisma.complianceCheck.findMany({
    orderBy: { createdAt: "asc" },
  });

  return rows.map((c) => ({
    id: c.id,
    organizationId: c.organizationId,
    leadId: c.leadId,
    userId: c.userId,
    purpose: c.purpose,
    status: c.status as "PASS" | "FAIL" | "SKIPPED",
    result: c.result,
    createdAt: c.createdAt,
  }));
}

