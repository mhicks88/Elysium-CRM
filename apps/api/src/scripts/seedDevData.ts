// apps/api/src/scripts/seedDevData.ts
//
// Dev-only seeder for Elysium CRM.
//
// What this does:
// - Ensures a default Organization ("Dev Org") with settings {}
// - Creates / upserts test users for each role (ADMIN, DIRECTOR, MANAGER, AGENT, COMPLIANCE, READ_ONLY)
// - Seeds:
//    * Leads (assigned to agent / manager / director + one unassigned)
//    * Tasks for various users
//    * Dialer integration
//    * Call sessions + pre-call checks
//    * Scope of appointment
//    * Compliance checks
//
// Run from apps/api with:
//   npx ts-node src/scripts/seedDevData.ts
//
// or via package.json script:
//   "seed:dev": "ts-node src/scripts/seedDevData.ts"

import {
  PrismaClient,
  UserRole,
  LeadSource,
  LeadStatus,
  TaskType,
  TaskStatus,
  TaskPriority,
  DialerIntegrationType,
  CallDirection,
  CallPurpose,
  CallStatus,
  ComplianceState,
  PreCallCheckType,
  PreCallCheckStatus,
  ScopeOfAppointmentChannel,
  ScopeOfAppointmentSignatureMethod,
  ScopeOfAppointmentStatus,
} from "@prisma/client";
import type { Organization } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

type DummyUser = {
  id: string;
  name: string;
  email: string;
  role: keyof typeof UserRole | string;
  password: string;
};

type DummyData = {
  users: DummyUser[];
  [key: string]: unknown;
};

type SeedUsers = {
  adminId: string;
  directorId: string;
  managerId: string;
  agentId: string;
  complianceId: string;
  readOnlyId: string;
};

type SeedLeadsResult = {
  agentPrimaryLeadId: string;
  agentSecondaryLeadId: string;
  managerLeadId: string;
  directorLeadId: string;
  unassignedLeadId: string;
};

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: "", lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(" ") || null };
}

async function ensureDevOrganization(): Promise<Organization> {
  console.log("Ensuring Dev Org exists...");

  let org = await prisma.organization.findFirst({
    where: { name: "Dev Org" },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Dev Org",
        settings: {}, // required Json field
      },
    });
    console.log(`Created Dev Org (${org.id})`);
  } else {
    console.log(`Found existing Dev Org (${org.id})`);
  }

  return org;
}

async function seedUsersFromDummyData(
  dummy: DummyData,
  organizationId: string
): Promise<SeedUsers> {
  console.log("Seeding dev users from dummyData.json...");

  const ids: Partial<SeedUsers> = {};

  for (const user of dummy.users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const { firstName, lastName } = splitName(user.name);

    const roleEnum: UserRole =
      (UserRole as any)[user.role as string] ?? UserRole.AGENT;

    const dbUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName,
        lastName: lastName ?? "",
        role: roleEnum,
        passwordHash,
        organization: {
          connect: { id: organizationId },
        },
      },
      create: {
        email: user.email,
        firstName,
        lastName: lastName ?? "",
        role: roleEnum,
        passwordHash,
        organization: {
          connect: { id: organizationId },
        },
      },
    });

    switch (roleEnum) {
      case UserRole.ADMIN:
        ids.adminId = dbUser.id;
        break;
      case UserRole.DIRECTOR:
        ids.directorId = dbUser.id;
        break;
      case UserRole.MANAGER:
        ids.managerId = dbUser.id;
        break;
      case UserRole.AGENT:
        ids.agentId = dbUser.id;
        break;
      case UserRole.COMPLIANCE:
        ids.complianceId = dbUser.id;
        break;
      case UserRole.READ_ONLY:
        ids.readOnlyId = dbUser.id;
        break;
    }

    console.log(`  - upserted user ${user.email} (${user.role})`);
  }

  const missing = Object.entries({
    adminId: ids.adminId,
    directorId: ids.directorId,
    managerId: ids.managerId,
    agentId: ids.agentId,
    complianceId: ids.complianceId,
    readOnlyId: ids.readOnlyId,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(`Missing seeded users for roles: ${missing.join(", ")}`);
  }

  console.log("Dev users seeded.");
  return ids as SeedUsers;
}

async function seedLeads(
  organizationId: string,
  users: SeedUsers
): Promise<SeedLeadsResult> {
  console.log("Seeding leads...");

  const now = new Date();

  const agentPrimary = await prisma.lead.create({
    data: {
      organizationId,
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: new Date("1952-05-12"),
      phonePrimary: "555-000-0001",
      phoneAlt: "555-000-1001",
      email: "john.doe@example.test",
      addressLine1: "123 Main St",
      addressLine2: "Apt 1",
      city: "Cleveland",
      state: "OH",
      zip: "44101",
      timeZone: "America/New_York",
      leadSource: LeadSource.WEB_FORM,
      permissionToContactPhone: true,
      permissionToContactEmail: false,
      permissionSource: "Dev seed - web form opt-in",
      permissionCapturedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30),
      status: LeadStatus.IN_DISCUSSION,
      assignedToUserId: users.agentId,
      notesSummary: "Interested in MA plan, wants low premium.",
    },
  });

  const agentSecondary = await prisma.lead.create({
    data: {
      organizationId,
      firstName: "Maria",
      lastName: "Lopez",
      dateOfBirth: new Date("1950-09-03"),
      phonePrimary: "555-000-0002",
      email: "maria.lopez@example.test",
      addressLine1: "456 Oak Ave",
      city: "Miami",
      state: "FL",
      zip: "33101",
      timeZone: "America/New_York",
      leadSource: LeadSource.INBOUND_CALL,
      permissionToContactPhone: true,
      permissionToContactEmail: true,
      permissionSource: "Dev seed - recorded call consent",
      permissionCapturedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      status: LeadStatus.SOA_REQUIRED,
      assignedToUserId: users.agentId,
      notesSummary: "Needs Spanish-speaking support; considering plan switch.",
    },
  });

  const managerLead = await prisma.lead.create({
    data: {
      organizationId,
      firstName: "Evelyn",
      lastName: "Ng",
      dateOfBirth: new Date("1947-01-20"),
      phonePrimary: "555-000-0003",
      email: "evelyn.ng@example.test",
      addressLine1: "789 Pine Rd",
      city: "Phoenix",
      state: "AZ",
      zip: "85001",
      timeZone: "America/Phoenix",
      leadSource: LeadSource.LIST,
      permissionToContactPhone: true,
      permissionToContactEmail: false,
      permissionSource: "Dev seed - list with consent attestation",
      permissionCapturedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60),
      status: LeadStatus.CONTACT_ATTEMPTED,
      assignedToUserId: users.managerId,
      notesSummary: "Manager is overseeing this high-priority lead.",
    },
  });

  const directorLead = await prisma.lead.create({
    data: {
      organizationId,
      firstName: "Robert",
      lastName: "King",
      dateOfBirth: new Date("1945-11-11"),
      phonePrimary: "555-000-0004",
      email: "robert.king@example.test",
      addressLine1: "101 Elm St",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      timeZone: "America/Chicago",
      leadSource: LeadSource.REFERRAL,
      permissionToContactPhone: true,
      permissionToContactEmail: true,
      permissionSource: "Dev seed - agent referral",
      permissionCapturedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 45),
      status: LeadStatus.NEW,
      assignedToUserId: users.directorId,
      notesSummary: "Referred by another enrollee; wants full benefit review.",
    },
  });

  const unassignedLead = await prisma.lead.create({
    data: {
      organizationId,
      firstName: "Pat",
      lastName: "Morgan",
      dateOfBirth: new Date("1955-03-15"),
      phonePrimary: "555-000-0005",
      email: "pat.morgan@example.test",
      addressLine1: "202 Cedar Blvd",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      timeZone: "America/Los_Angeles",
      leadSource: LeadSource.TRANSFER,
      permissionToContactPhone: true,
      permissionToContactEmail: true,
      permissionSource: "Dev seed - warm transfer",
      permissionCapturedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
      status: LeadStatus.NEW,
      assignedToUserId: null,
      notesSummary: "Waiting in general queue; not yet assigned.",
    },
  });

  console.log("Leads seeded.");

  return {
    agentPrimaryLeadId: agentPrimary.id,
    agentSecondaryLeadId: agentSecondary.id,
    managerLeadId: managerLead.id,
    directorLeadId: directorLead.id,
    unassignedLeadId: unassignedLead.id,
  };
}

async function seedTasks(
  organizationId: string,
  users: SeedUsers,
  leads: SeedLeadsResult
) {
  console.log("Seeding tasks...");

  const now = Date.now();

  await prisma.task.createMany({
    data: [
      {
        organizationId,
        leadId: leads.agentPrimaryLeadId,
        assignedToUserId: users.agentId,
        type: TaskType.CALL_BACK,
        status: TaskStatus.OPEN,
        priority: TaskPriority.HIGH,
        title: "Callback about MA plan options",
        description: "Lead asked for callback tomorrow morning.",
        dueAt: new Date(now + 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        leadId: leads.agentSecondaryLeadId,
        assignedToUserId: users.agentId,
        type: TaskType.DOCUMENT_REQUEST,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        title: "Collect current plan information",
        description: "Need list of medications and doctors for comparison.",
        dueAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        leadId: leads.managerLeadId,
        assignedToUserId: users.managerId,
        type: TaskType.COMPLIANCE_REVIEW,
        status: TaskStatus.OPEN,
        priority: TaskPriority.HIGH,
        title: "Review script adherence for recent calls",
        description:
          "Manager to review calls for Evelyn Ng to ensure script compliance.",
        dueAt: new Date(now + 5 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        leadId: leads.directorLeadId,
        assignedToUserId: users.directorId,
        type: TaskType.FOLLOW_UP,
        status: TaskStatus.OPEN,
        priority: TaskPriority.MEDIUM,
        title: "Director follow-up on VIP referral",
        description:
          "Director to ensure experience quality for high-value referral.",
        dueAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        leadId: leads.unassignedLeadId,
        assignedToUserId: users.managerId,
        type: TaskType.CALL_BACK,
        status: TaskStatus.OPEN,
        priority: TaskPriority.LOW,
        title: "Assign lead from general queue",
        description: "Manager to assign Pat Morgan to an available agent.",
        dueAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("Tasks seeded.");
}

async function seedDialerAndCalls(
  organizationId: string,
  users: SeedUsers,
  leads: SeedLeadsResult
) {
  console.log("Seeding dialer integration and call sessions...");

  const dialer = await prisma.dialerIntegration.create({
    data: {
      organizationId,
      name: "Dev Generic Dialer",
      type: DialerIntegrationType.GENERIC_HTTP,
      baseUrl: "https://dialer.dev.local",
      apiKey: "dev-api-key",
      settings: {},
      isActive: true,
    },
  });

  const start1 = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
  const connect1 = new Date(start1.getTime() + 1000 * 10);
  const end1 = new Date(start1.getTime() + 1000 * 60 * 15);

  const call1 = await prisma.callSession.create({
    data: {
      organizationId,
      leadId: leads.agentPrimaryLeadId,
      agentId: users.agentId,
      dialerIntegrationId: dialer.id,
      externalCallId: "DEV-CALL-1",
      direction: CallDirection.OUTBOUND,
      purpose: CallPurpose.ENROLLMENT,
      status: CallStatus.COMPLETED,
      complianceState: ComplianceState.READY_FOR_ENROLLMENT,
      startedAt: start1,
      connectedAt: connect1,
      endedAt: end1,
      recordingUrl: "https://recordings.dev.local/dev-call-1",
    },
  });

  const start2 = new Date(Date.now() - 1000 * 60 * 20); // 20 mins ago
  const call2 = await prisma.callSession.create({
    data: {
      organizationId,
      leadId: leads.agentSecondaryLeadId,
      agentId: users.agentId,
      dialerIntegrationId: dialer.id,
      externalCallId: "DEV-CALL-2",
      direction: CallDirection.OUTBOUND,
      purpose: CallPurpose.EDUCATION,
      status: CallStatus.FAILED,
      complianceState: ComplianceState.PRE_CALL_CHECKS_FAILED,
      startedAt: start2,
      connectedAt: null,
      endedAt: new Date(start2.getTime() + 1000 * 30),
      recordingUrl: null,
    },
  });

  // Pre-call checks for call1 (pass)
  await prisma.preCallCheck.createMany({
    data: [
      {
        callSessionId: call1.id,
        checkType: PreCallCheckType.PERMISSION_TO_CONTACT,
        status: PreCallCheckStatus.PASS,
        details: "Lead granted permission on 2024-01-01.",
      },
      {
        callSessionId: call1.id,
        checkType: PreCallCheckType.DO_NOT_CONTACT_STATUS,
        status: PreCallCheckStatus.PASS,
        details: "Not on DNC list.",
      },
    ],
  });

  // Pre-call checks for call2 (fail)
  await prisma.preCallCheck.createMany({
    data: [
      {
        callSessionId: call2.id,
        checkType: PreCallCheckType.DO_NOT_CONTACT_STATUS,
        status: PreCallCheckStatus.FAIL,
        details: "Simulated DNC match in dev seed.",
      },
    ],
  });

  // Scope of Appointment tied to call1
  await prisma.scopeOfAppointment.create({
    data: {
      organizationId,
      leadId: leads.agentPrimaryLeadId,
      agentId: users.agentId,
      callSessionId: call1.id,
      appointmentDate: start1,
      channel: ScopeOfAppointmentChannel.TELEPHONIC,
      productTypes: ["MA", "PDP"],
      statementAcknowledged: true,
      signatureMethod: ScopeOfAppointmentSignatureMethod.ELECTRONIC,
      signatureEvidenceUrl: "https://evidence.dev.local/soa/dev-call-1",
      status: ScopeOfAppointmentStatus.SIGNED,
      signedAt: connect1,
      expiresAt: new Date(start1.getTime() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  // Compliance checks for both leads
  await prisma.complianceCheck.create({
    data: {
      organizationId,
      leadId: leads.agentPrimaryLeadId,
      userId: users.complianceId,
      purpose: "Pre-call compliance check",
      status: "PASSED",
      result: {
        preCallChecks: "All checks passed in dev seed",
        callSessionId: call1.id,
      },
    },
  });

  await prisma.complianceCheck.create({
    data: {
      organizationId,
      leadId: leads.agentSecondaryLeadId,
      userId: users.complianceId,
      purpose: "Pre-call compliance check",
      status: "FAILED",
      result: {
        preCallChecks: "Simulated DNC failure in dev seed",
        callSessionId: call2.id,
      },
    },
  });

  console.log("Dialer, calls, pre-call checks, SOA, and compliance checks seeded.");
}

async function main() {
  const dummyPath = path.join(__dirname, "dummyData.json");
  const jsonRaw = fs.readFileSync(dummyPath, "utf-8");
  const dummy: DummyData = JSON.parse(jsonRaw);

  // 1) Ensure there is an organization to attach users & data to
  const devOrg = await ensureDevOrganization();

  // 2) Seed users (AUTH uses these)
  const users = await seedUsersFromDummyData(dummy, devOrg.id);

  // 3) Seed domain data for this org
  const leads = await seedLeads(devOrg.id, users);
  await seedTasks(devOrg.id, users, leads);
  await seedDialerAndCalls(devOrg.id, users, leads);

  console.log("Dev data seeding complete.");
}

main()
  .catch((err) => {
    console.error("Error while seeding dev data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

