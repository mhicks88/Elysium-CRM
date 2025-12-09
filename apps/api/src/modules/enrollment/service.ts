// apps/api/src/modules/enrollment/service.ts
//
// DB-backed Enrollment Journey service using Prisma EnrollmentJourney model.

import { prisma } from "../../db/client";
import type { $Enums } from "@prisma/client";
import {
  Enrollment,
  EnrollmentStage,
  UpsertEnrollmentInput,
} from "./types";

/**
 * Get enrollment journey for a lead, scoped by organization.
 */
export async function getEnrollmentForLead(
  organizationId: string,
  leadId: string
): Promise<Enrollment | null> {
  if (!organizationId || !leadId) return null;

  const row = await prisma.enrollmentJourney.findFirst({
    where: {
      organizationId,
      leadId,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    leadId: row.leadId,
    stage: row.stage as EnrollmentStage,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Map an enrollment stage to a lead "status" (for the main leads list),
 * or null if we don't want to touch the lead status for that stage.
 *
 * We keep this conservative for now:
 * - ENROLLED   → Lead.status = ENROLLED
 * - WITHDRAWN  → Lead.status = DO_NOT_CONTACT (closed out)
 */
function inferLeadStatusFromStage(
  stage: EnrollmentStage
): $Enums.LeadStatus | null {
  switch (stage) {
    case "ENROLLED":
      return "ENROLLED";
    case "WITHDRAWN":
      return "DO_NOT_CONTACT";
    default:
      return null;
  }
}

/**
 * Upsert enrollment journey for a lead.
 *
 * We:
 * - Ensure the lead exists AND belongs to this organization
 * - Create or update the EnrollmentJourney row for that lead
 * - Optionally update the lead.status based on the enrollment stage
 * - Optionally track who updated it via updatedByUserId (future enhancement)
 */
export async function upsertEnrollmentForLead(
  organizationId: string,
  leadId: string,
  input: UpsertEnrollmentInput
): Promise<Enrollment> {
  if (!organizationId || !leadId) {
    throw new Error(
      "organizationId and leadId are required for enrollment upsert"
    );
  }

  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      organizationId,
    },
    select: { id: true, organizationId: true },
  });

  if (!lead) {
    throw new Error(
      `Lead not found for enrollment (leadId=${leadId}, org=${organizationId})`
    );
  }

  const existing = await prisma.enrollmentJourney.findFirst({
    where: {
      organizationId,
      leadId: lead.id,
    },
  });

  const stage = input.stage as EnrollmentStage; // matches EnrollmentJourneyStage enum values
  const notes = input.notes ?? null;

  let saved;
  if (existing) {
    saved = await prisma.enrollmentJourney.update({
      where: { id: existing.id },
      data: {
        stage,
        notes,
      },
    });
  } else {
    saved = await prisma.enrollmentJourney.create({
      data: {
        organizationId: lead.organizationId,
        leadId: lead.id,
        stage,
        notes,
      },
    });
  }

  // Keep the Lead's high-level status in sync with key enrollment stages
  const inferredLeadStatus = inferLeadStatusFromStage(stage);
  if (inferredLeadStatus) {
    try {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: inferredLeadStatus,
        },
      });
    } catch (err) {
      // Don't fail the enrollment operation if the status sync fails;
      // log and continue. You can tighten this later if needed.
      console.error(
        "Failed to sync enrollment stage to lead status",
        {
          leadId: lead.id,
          stage,
          inferredLeadStatus,
          error: String(err),
        }
      );
    }
  }

  return {
    id: saved.id,
    leadId: saved.leadId,
    stage: saved.stage as EnrollmentStage,
    notes: saved.notes ?? null,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}

/**
 * Simple guard for valid stage transitions.
 * We keep this as a string check matching our union + enum.
 */
export function isValidStage(stage: string): stage is EnrollmentStage {
  return [
    "NOT_STARTED",
    "DISCOVERY",
    "UNDER_REVIEW",
    "PENDING_DOCS",
    "ENROLLED",
    "WITHDRAWN",
  ].includes(stage);
}

