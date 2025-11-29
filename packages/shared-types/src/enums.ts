// packages/shared-types/src/enums.ts

export enum LeadStatus {
  NEW = "NEW",
  IN_PROGRESS = "IN_PROGRESS",
  ENROLLED = "ENROLLED",
  DO_NOT_CONTACT = "DO_NOT_CONTACT",
}

// Used by call-related DTOs
export enum CallDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

export enum CallPurpose {
  EDUCATION = "EDUCATION",
  MARKETING = "MARKETING",
  ENROLLMENT = "ENROLLMENT",
  SERVICE = "SERVICE",
}

export enum CallStatus {
  INITIATED = "INITIATED",
  CONNECTED = "CONNECTED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum ComplianceState {
  UNKNOWN = "UNKNOWN",
  PASS = "PASS",
  FAIL = "FAIL",
}

// Enrollment-related DTOs
export enum EnrollmentStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum EnrollmentVerificationMethod {
  CALL = "CALL",
  SMS = "SMS",
  EMAIL = "EMAIL",
  LETTER = "LETTER",
}

export enum EnrollmentVerificationOutcome {
  VERIFIED = "VERIFIED",
  UNVERIFIED = "UNVERIFIED",
  FAILED = "FAILED",
}

// Task-related DTOs
export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum TaskStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum TaskType {
  FOLLOW_UP = "FOLLOW_UP",
  OUTBOUND_CALL = "OUTBOUND_CALL",
  ENROLLMENT = "ENROLLMENT",
  OTHER = "OTHER",
}

// Other enums (UserRole, etc.) can go here if needed
export enum UserRole {
  ADMIN = "ADMIN",
  AGENT = "AGENT",
  MANAGER = "MANAGER",
}

