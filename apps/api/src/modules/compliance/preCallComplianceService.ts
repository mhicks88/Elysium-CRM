import {
  LeadStatus,
  PreCallCheckStatus as PrismaPreCallCheckStatus,
  PreCallCheckType as PrismaPreCallCheckType,
  ScopeOfAppointmentStatus,
} from "@prisma/client";

import { prisma } from "../../db/client";

export type PlannedCallPurpose =
  | "EDUCATION"
  | "MARKETING"
  | "ENROLLMENT"
  | "SERVICE";

export type PreCallCheckType =
  | "PERMISSION_TO_CONTACT"
  | "DO_NOT_CONTACT_STATUS"
  | "SOA_VALIDITY"
  | "ELECTION_PERIOD_VALIDITY"
  | "STATE_SPECIFIC_RULES";

export interface IndividualPreCallCheckResult {
  type: PreCallCheckType;
  status: "PASS" | "FAIL" | "SKIPPED";
  message?: string;
}

export interface PreCallCheckResult {
  status: "PASS" | "FAIL";
  reasons: string[];
  checks: IndividualPreCallCheckResult[];
}

export async function runPreCallChecks(params: {
  leadId: string;
  agentUserId: string;
  purpose: PlannedCallPurpose;
  callSessionId?: string;
}): Promise<PreCallCheckResult> {
  const { leadId, agentUserId, purpose, callSessionId } = params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const checks: IndividualPreCallCheckResult[] = [];
  const reasons: string[] = [];

  const addCheck = (check: IndividualPreCallCheckResult) => {
    checks.push(check);
    if (check.status === "FAIL" && check.message) {
      reasons.push(check.message);
    }
  };

  // 1. Do not contact status
  if (lead.status === LeadStatus.DO_NOT_CONTACT) {
    addCheck({
      type: "DO_NOT_CONTACT_STATUS",
      status: "FAIL",
      message: "Lead is marked as Do Not Contact.",
    });
  } else {
    addCheck({ type: "DO_NOT_CONTACT_STATUS", status: "PASS" });
  }

  // 2. Permission to contact
  if (purpose === "MARKETING" || purpose === "ENROLLMENT") {
    if (!lead.permissionToContactPhone) {
      addCheck({
        type: "PERMISSION_TO_CONTACT",
        status: "FAIL",
        message: "Lead has not granted permission to contact by phone for marketing/enrollment.",
      });
    } else {
      addCheck({ type: "PERMISSION_TO_CONTACT", status: "PASS" });
    }
  } else {
    addCheck({
      type: "PERMISSION_TO_CONTACT",
      status: "SKIPPED",
      message: "Not required for this purpose.",
    });
  }

  // 3. Scope of Appointment validity
  if (purpose === "MARKETING" || purpose === "ENROLLMENT") {
    const activeScope = await prisma.scopeOfAppointment.findFirst({
      where: {
        leadId,
        status: ScopeOfAppointmentStatus.SIGNED,
        OR: [
          { expiresAt: null },
          {
            expiresAt: {
              gt: new Date(),
            },
          },
        ],
      },
    });

    if (!activeScope) {
      addCheck({
        type: "SOA_VALIDITY",
        status: "FAIL",
        message: "No active Scope of Appointment found for marketing/enrollment.",
      });
    } else {
      addCheck({ type: "SOA_VALIDITY", status: "PASS" });
    }
  } else {
    addCheck({
      type: "SOA_VALIDITY",
      status: "SKIPPED",
      message: "Not required for this purpose.",
    });
  }

  // 4. Election period validity (placeholder)
  addCheck({
    type: "ELECTION_PERIOD_VALIDITY",
    status: "SKIPPED",
    message: "Election period rules not implemented yet.",
  });

  // 5. State specific rules (placeholder)
  addCheck({
    type: "STATE_SPECIFIC_RULES",
    status: "SKIPPED",
    message: "State-specific rules not implemented yet.",
  });

  const overallStatus = checks.some((check) => check.status === "FAIL")
    ? "FAIL"
    : "PASS";

  const result: PreCallCheckResult = {
    status: overallStatus,
    reasons,
    checks,
  };

  if (callSessionId) {
    await Promise.all(
      checks.map((check) =>
        prisma.preCallCheck.create({
          data: {
            callSessionId,
            checkType: check.type as PrismaPreCallCheckType,
            status: check.status as PrismaPreCallCheckStatus,
            details: check.message,
            checkedByUserId: agentUserId,
          },
        })
      )
    );
  }

  return result;
}
