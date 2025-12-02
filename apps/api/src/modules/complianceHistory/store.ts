import crypto from "crypto";

export interface ComplianceCheckRecord {
  id: string;
  leadId: string;
  userId: string;
  purpose: string;
  status: "PASS" | "FAIL";
  result: any;
  createdAt: Date;
}

// In-memory store for now (swap to DB later)
const complianceChecks: ComplianceCheckRecord[] = [];

export function addComplianceCheck(
  entry: Omit<ComplianceCheckRecord, "id" | "createdAt">
) {
  const record: ComplianceCheckRecord = {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString("hex"),
    createdAt: new Date(),
    ...entry,
  };

  complianceChecks.push(record);
  return record;
}

export function getComplianceChecksByLead(leadId: string) {
  return complianceChecks
    .filter((c) => c.leadId === leadId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

