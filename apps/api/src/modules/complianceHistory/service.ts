import {
  addComplianceCheck,
  getComplianceChecksByLead,
  type ComplianceCheckRecord,
} from "./store";

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

