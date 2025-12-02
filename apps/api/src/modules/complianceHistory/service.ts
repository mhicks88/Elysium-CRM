import {
  addComplianceCheck,
  getComplianceChecksByLead,
  getAllComplianceChecks,
  type ComplianceCheckRecord,
} from "./store";

export type { ComplianceCheckRecord };

export async function recordComplianceCheck(params: {
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL";
  result: any;
}): Promise<ComplianceCheckRecord> {
  return addComplianceCheck(params);
}

export async function listComplianceChecks(
  leadId: string
): Promise<ComplianceCheckRecord[]> {
  return getComplianceChecksByLead(leadId);
}

export async function listAllComplianceChecks(): Promise<
  ComplianceCheckRecord[]
> {
  return getAllComplianceChecks();
}

