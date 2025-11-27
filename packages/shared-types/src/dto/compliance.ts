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

export interface PreCallCheckDto {
  type: PreCallCheckType;
  status: "PASS" | "FAIL" | "SKIPPED";
  message?: string;
}

export interface PreCallCheckResultDto {
  status: "PASS" | "FAIL";
  reasons: string[];
  checks: PreCallCheckDto[];
}
