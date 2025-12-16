// apps/api/src/scripts/seedDemoOrg.ts
//
// Demo / staging seeder for Elysium CRM.
//
// What this does:
// - Creates a new Organization ("Elysium Demo Insurance") if it does not exist
// - Seeds users for each role (ADMIN, DIRECTOR, MANAGER, two AGENTs, COMPLIANCE, READ_ONLY)
// - Seeds a handful of leads with different statuses & permissions
// - Seeds tasks for those leads
// - Seeds a simple interactive Call Script so the Scripts tab has something real
// - Seeds a few ComplianceCheck rows so the Admin compliance dashboard has data
//
// It does **not** depend on dummyData.json. It's separate from seedDevData.ts.
//
// Run from apps/api with:
//   npx ts-node src/scripts/seedDemoOrg.ts
//
// (Optionally add a package.json script:  "seed:demo-org": "ts-node src/scripts/seedDemoOrg.ts")

import {
  PrismaClient,
  UserRole,
  LeadSource,
  LeadStatus,
  TaskType,
  TaskStatus,
  TaskPriority,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_ORG_NAME = "Elysium Demo Insurance";
const DEMO_PASSWORD = "Password123!";

async function createDemoOrg() {
  const existing = await prisma.organization.findFirst({
    where: { name: DEMO_ORG_NAME },
  });

  if (existing) {
    console.log(
      `ℹ️ Demo org "${DEMO_ORG_NAME}" already exists (id=${existing.id}). Skipping creation.`
    );
    return existing;
  }

  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      settings: {
        timezone: "America/New_York",
        dialingHours: {
          start: "09:00",
          end: "20:00",
          tz: "America/New_York",
        },
        compliance: {
          enableDoNotContactChecks: true,
          enablePermissionToContactChecks: true,
        },
      },
    },
  });

  console.log(`✅ Created demo org "${DEMO_ORG_NAME}" (${org.id})`);
  return org;
}

type DemoUsers = {
  admin: string;
  director: string;
  manager: string;
  agent1: string;
  agent2: string;
  compliance: string;
  readOnly: string;
};

async function seedDemoUsers(organizationId: string): Promise<DemoUsers> {
  console.log("👤 Seeding demo users...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: "demo.admin@elysiumcrm.test" },
    update: {
      organizationId,
      firstName: "Dana",
      lastName: "Admin",
      role: UserRole.ADMIN,
      isActive: true,
      passwordHash,
    },
    create: {
      organizationId,
      firstName: "Dana",
      lastName: "Admin",
      email: "demo.admin@elysiumcrm.test",
      role: UserRole.ADMIN,
      isActive: true,
      passwordHash,
    },
  });

  const director = await prisma.user.upsert({
    where: { email: "demo.director@elysiumcrm.test" },
    update: {
      organizationId,
      firstName: "Drew",
      lastName: "Director",
      role: UserRole.DIRECTOR,
      isActive: true,
      passwordHash,
    },
    create: {
      organizationId,
      firstName: "Drew",
      lastName: "Director",
      email: "demo.director@elysiumcrm.test",
      role: UserRole.DIRECTOR,
      isActive: true,
      passwordHash,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "demo.manager@elysiumcrm.test" },
    update: {
      organizationId,
      firstName: "Mia",
      lastName: "Manager",
      role: UserRole.MANAGER,
      isActive: true,
      passwordHash,
      directorId: director.id,
    },
    create: {
      organizationId,
      firstName: "Mia",
      lastName: "Manager",
      email: "demo.manager@elysiumcrm.test",
      role: UserRole.MANAGER,
      isActive: true,
      passwordHash,
      directorId: director.id,
    },
  });

  const agent1 = await prisma.user.upsert({
    where: { email: "demo.agent1@elysiumcrm.test" },
    update: {
      organizationId,
      firstName: "Alex",
      lastName: "Agent",
      role: UserRole.AGENT,
      isActive: true,
      passwordHash,
      managerId: manager.id,
      directorId: director.id,
    },
    create: {
      organizationId,
      firstName: "Alex",
      lastName: "Agent",
      email: "demo.agent1@elysiumcrm.test",
      role: UserRole.AGENT,
      isActive: true,
      passwordHash,
      managerId: manager.id,
      directorId: director.id,
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: "demo.agent2@elysiumcrm.test" },
    update: {
      organizationId,
      firstName: "Riley",
      lastName: "Agent",
      role: UserRole.AGENT,
      isActive: true,
      passwordHash,
      managerId: manager.id,
      directorId: director.id,
    },
    create: {
      organizationId,
      firstName: "Riley",
      lastName: "Agent",
      email: "demo.agent2@elysiumcrm.test",
      role: UserRole.AGENT,
      isActive: true,
      passwordHash,
      managerId: manager.id,
      directorId: director.id,
    },
  });

  const compliance = await prisma.user.upsert({
    where: { email: "demo.compliance@elysiumcrm.test" },
    update: {
      organizationId,
      firstName: "Casey",
      lastName: "Compliance",
      role: UserRole.COMPLIANCE,
      isActive: true,
      passwordHash,
    },
    create: {
      organizationId,
      firstName: "Casey",
      lastName: "Compliance",
      email: "demo.compliance@elysiumcrm.test",
      role: UserRole.COMPLIANCE,
      isActive: true,
      passwordHash,
    },
  });

  const readOnly = await prisma.user.upsert({
    where: { email: "demo.readonly@elysiumcrm.test" },
    update: {
      organizationId,
      firstName: "Rae",
      lastName: "Viewer",
      role: UserRole.READ_ONLY,
      isActive: true,
      passwordHash,
    },
    create: {
      organizationId,
      firstName: "Rae",
      lastName: "Viewer",
      email: "demo.readonly@elysiumcrm.test",
      role: UserRole.READ_ONLY,
      isActive: true,
      passwordHash,
    },
  });

  console.log("✅ Demo users seeded.");
  console.log("   Login password for all demo users:", DEMO_PASSWORD);

  return {
    admin: admin.id,
    director: director.id,
    manager: manager.id,
    agent1: agent1.id,
    agent2: agent2.id,
    compliance: compliance.id,
    readOnly: readOnly.id,
  };
}

type DemoLeads = {
  warmLeadId: string;
  inboundLeadId: string;
  dncLeadId: string;
  enrolledLeadId: string;
  soaLeadId: string;
};

async function seedDemoLeads(
  organizationId: string,
  users: DemoUsers
): Promise<DemoLeads> {
  console.log("📇 Seeding demo leads...");

  const now = new Date();

  const createLead = (data: {
    firstName: string;
    lastName: string;
    phonePrimary: string;
    email?: string | null;
    state?: string;
    source?: LeadSource;
    status?: LeadStatus;
    assignedToUserId?: string | null;
    permissionToContactPhone?: boolean;
    permissionToContactEmail?: boolean;
    notesSummary?: string | null;
  }) =>
    prisma.lead.create({
      data: {
        organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date("1952-01-01T00:00:00Z"),
        phonePrimary: data.phonePrimary,
        phoneAlt: null,
        email: data.email ?? null,
        addressLine1: "123 Main St",
        addressLine2: null,
        city: "Orlando",
        state: data.state ?? "FL",
        zip: "32801",
        timeZone: "America/New_York",
        leadSource: data.source ?? LeadSource.LIST,
        permissionToContactPhone: data.permissionToContactPhone ?? true,
        permissionToContactEmail: data.permissionToContactEmail ?? true,
        permissionSource: "Demo seed",
        permissionCapturedAt: now,
        status: data.status ?? LeadStatus.NEW,
        assignedToUserId: data.assignedToUserId ?? null,
        notesSummary: data.notesSummary ?? null,
      },
    });

  const warmLead = await createLead({
    firstName: "Mary",
    lastName: "Warm",
    phonePrimary: "555-111-0001",
    email: "mary.warm@example.test",
    source: LeadSource.REFERRAL,
    status: LeadStatus.IN_DISCUSSION,
    assignedToUserId: users.agent1,
    notesSummary:
      "Referred by existing enrollee. Interested in Medicare Advantage plan with low co-pays.",
  });

  const inboundLead = await createLead({
    firstName: "Isaac",
    lastName: "Inbound",
    phonePrimary: "555-111-0002",
    email: "isaac.inbound@example.test",
    source: LeadSource.INBOUND_CALL,
    status: LeadStatus.NEW,
    assignedToUserId: users.agent2,
    notesSummary: "Called in from TV ad. Wants overview of options.",
  });

  const dncLead = await createLead({
    firstName: "Donna",
    lastName: "DoNotContact",
    phonePrimary: "555-111-0003",
    email: "donna.dnc@example.test",
    source: LeadSource.LIST,
    status: LeadStatus.DO_NOT_CONTACT,
    assignedToUserId: users.agent1,
    permissionToContactPhone: false,
    permissionToContactEmail: false,
    notesSummary: "Requested to be removed from all marketing.",
  });

  const enrolledLead = await createLead({
    firstName: "Elliot",
    lastName: "Enrolled",
    phonePrimary: "555-111-0004",
    email: "elliot.enrolled@example.test",
    source: LeadSource.TRANSFER,
    status: LeadStatus.ENROLLED,
    assignedToUserId: users.agent1,
    notesSummary: "Enrollment completed last week. Follow-up scheduled.",
  });

  const soaLead = await createLead({
    firstName: "Sofia",
    lastName: "SOA",
    phonePrimary: "555-111-0005",
    email: "sofia.soa@example.test",
    source: LeadSource.WEB_FORM,
    status: LeadStatus.SOA_REQUIRED,
    assignedToUserId: users.agent2,
    notesSummary: "Needs SOA before discussing plan options.",
  });

  console.log("✅ Demo leads seeded.");

  return {
    warmLeadId: warmLead.id,
    inboundLeadId: inboundLead.id,
    dncLeadId: dncLead.id,
    enrolledLeadId: enrolledLead.id,
    soaLeadId: soaLead.id,
  };
}

async function seedDemoTasks(
  organizationId: string,
  users: DemoUsers,
  leads: DemoLeads
) {
  console.log("📝 Seeding demo tasks...");

  const now = Date.now();

  await prisma.task.createMany({
    data: [
      {
        organizationId,
        leadId: leads.warmLeadId,
        assignedToUserId: users.agent1,
        type: TaskType.FOLLOW_UP,
        status: TaskStatus.OPEN,
        priority: TaskPriority.HIGH,
        title: "Follow up on plan comparison",
        description:
          "Call Mary to walk through 3 shortlisted Medicare Advantage plans.",
        dueAt: new Date(now + 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        leadId: leads.soaLeadId,
        assignedToUserId: users.agent2,
        type: TaskType.DOCUMENT_REQUEST,
        status: TaskStatus.OPEN,
        priority: TaskPriority.MEDIUM,
        title: "Obtain SOA",
        description: "Send SOA to Sofia and confirm signature.",
        dueAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        leadId: leads.enrolledLeadId,
        assignedToUserId: users.compliance,
        type: TaskType.COMPLIANCE_REVIEW,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        title: "Post-enrollment compliance review",
        description:
          "Review call notes and enrollment workflow for Elliot Enrolled.",
        dueAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("✅ Demo tasks seeded.");
}

async function seedDemoCallScript(organizationId: string) {
  console.log("📜 Seeding demo call script...");

  const script = await prisma.callScript.create({
    data: {
      organizationId,
      name: "T65 Welcome & Qualification",
      purpose: "ENROLLMENT",
      description:
        "Short guided script for turning T65 leads into compliant enrollments.",
      isActive: true,
    },
  });

  const introNode = await prisma.callScriptNode.create({
    data: {
      scriptId: script.id,
      label: "Intro",
      content:
        "Hi, this is {{agent_name}} calling from Elysium Insurance. Am I speaking with {{lead_name}}?",
      isTerminal: false,
    },
  });

  const qualifyNode = await prisma.callScriptNode.create({
    data: {
      scriptId: script.id,
      label: "Qualification",
      content:
        "I'd like to ask a few quick questions about your current coverage and needs so we can see what plans might fit.",
      isTerminal: false,
    },
  });

  const closeNode = await prisma.callScriptNode.create({
    data: {
      scriptId: script.id,
      label: "Close",
      content:
        "Based on what you've shared, I recommend we walk through a couple of plan options together now.",
      isTerminal: true,
    },
  });

  await prisma.callScriptOption.createMany({
    data: [
      {
        nodeId: introNode.id,
        label: "Yes, this is them",
        nextNodeId: qualifyNode.id,
      },
      {
        nodeId: introNode.id,
        label: "Not a good time",
        nextNodeId: null,
      },
      {
        nodeId: qualifyNode.id,
        label: "Yes, continue",
        nextNodeId: closeNode.id,
      },
      {
        nodeId: qualifyNode.id,
        label: "No, reschedule",
        nextNodeId: null,
      },
    ],
  });

  await prisma.callScript.update({
    where: { id: script.id },
    data: { entryNodeId: introNode.id },
  });

  console.log("✅ Demo call script seeded:", script.name);
}

async function seedDemoCompliance(
  organizationId: string,
  users: DemoUsers,
  leads: DemoLeads
) {
  console.log("⚖️ Seeding demo compliance checks...");

  await prisma.complianceCheck.createMany({
    data: [
      {
        organizationId,
        leadId: leads.warmLeadId,
        userId: users.agent1,
        purpose: "ENROLLMENT",
        status: "PASS",
        result: {
          checks: [
            { type: "PERMISSION_TO_CONTACT", status: "PASS" },
            { type: "DO_NOT_CONTACT_STATUS", status: "PASS" },
          ],
          notes: "Warm referral, fully opted in.",
        },
      },
      {
        organizationId,
        leadId: leads.dncLeadId,
        userId: users.agent1,
        purpose: "MARKETING",
        status: "FAIL",
        result: {
          checks: [
            { type: "PERMISSION_TO_CONTACT", status: "FAIL" },
            { type: "DO_NOT_CONTACT_STATUS", status: "FAIL" },
          ],
          reason: "Lead marked as Do Not Contact.",
        },
      },
      {
        organizationId,
        leadId: leads.soaLeadId,
        userId: users.agent2,
        purpose: "ENROLLMENT",
        status: "FAIL",
        result: {
          checks: [{ type: "SOA_VALIDITY", status: "FAIL" }],
          reason: "SOA missing or expired.",
        },
      },
    ],
  });

  console.log("✅ Demo compliance checks seeded.");
}

async function main() {
  try {
    const org = await createDemoOrg();
    const users = await seedDemoUsers(org.id);
    const leads = await seedDemoLeads(org.id, users);
    await seedDemoTasks(org.id, users, leads);
    await seedDemoCallScript(org.id);
    await seedDemoCompliance(org.id, users, leads);

    console.log("🎉 Demo org seeding complete.");
    console.log("   Org:", DEMO_ORG_NAME);
    console.log("   Admin login: demo.admin@elysiumcrm.test");
    console.log("   Password:   ", DEMO_PASSWORD);
  } catch (err) {
    console.error("❌ Error while seeding demo org:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

