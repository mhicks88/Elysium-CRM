import {
  PrismaClient,
  UserRole,
  LeadStatus,
  LeadSource,
  DialerIntegrationType,
  CallPurpose,
  CallDirection,
  CallStatus,
  ComplianceState,
  ScriptCategory,
  ScopeOfAppointmentChannel,
  ScopeOfAppointmentSignatureMethod,
  ScopeOfAppointmentStatus,
  EnrollmentStatus,
  EnrollmentVerificationMethod,
  EnrollmentVerificationOutcome,
  TaskType,
  TaskStatus,
  TaskPriority,
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const org = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: {},
    create: {
      id: "demo-org",
      name: "Demo Organization",
      settings: {},
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      organizationId: org.id,
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      organizationId: org.id,
      firstName: "Agent",
      lastName: "User",
      email: "agent@example.com",
      passwordHash,
      role: UserRole.AGENT,
      isActive: true,
    },
  });

  await prisma.lead.createMany({
    data: [
      {
        organizationId: org.id,
        firstName: "DoNot",
        lastName: "Contact",
        dateOfBirth: new Date("1950-01-01"),
        phonePrimary: "555-0001",
        phoneAlt: null,
        email: "donot@example.com",
        addressLine1: "123 No Call St",
        addressLine2: null,
        city: "Austin",
        state: "TX",
        zip: "73301",
        timeZone: "America/Chicago",
        leadSource: LeadSource.LIST,
        permissionToContactPhone: false,
        permissionToContactEmail: true,
        permissionSource: "seed",
        permissionCapturedAt: new Date(),
        status: LeadStatus.DO_NOT_CONTACT,
        assignedToUserId: agent.id,
        notesSummary: "Seed lead marked DNC",
      },
      {
        organizationId: org.id,
        firstName: "NoPhone",
        lastName: "Permission",
        dateOfBirth: new Date("1955-02-02"),
        phonePrimary: "555-0002",
        phoneAlt: null,
        email: "noperm@example.com",
        addressLine1: "456 Opt Out Ave",
        addressLine2: null,
        city: "Dallas",
        state: "TX",
        zip: "75001",
        timeZone: "America/Chicago",
        leadSource: LeadSource.WEB_FORM,
        permissionToContactPhone: false,
        permissionToContactEmail: true,
        permissionSource: "seed",
        permissionCapturedAt: new Date(),
        status: LeadStatus.NEW,
        assignedToUserId: agent.id,
        notesSummary: "Phone contact not permitted",
      },
      {
        organizationId: org.id,
        firstName: "Contact",
        lastName: "Ready",
        dateOfBirth: new Date("1958-03-03"),
        phonePrimary: "555-0003",
        phoneAlt: null,
        email: "ready@example.com",
        addressLine1: "789 Ready Rd",
        addressLine2: null,
        city: "Houston",
        state: "TX",
        zip: "77001",
        timeZone: "America/Chicago",
        leadSource: LeadSource.REFERRAL,
        permissionToContactPhone: true,
        permissionToContactEmail: true,
        permissionSource: "seed",
        permissionCapturedAt: new Date(),
        status: LeadStatus.SOA_REQUIRED,
        assignedToUserId: agent.id,
        notesSummary: "Ready for outreach",
      },
    ],
  });

  const dialerIntegration =
    await prisma.dialerIntegration.create({
      data: {
        organizationId: org.id,
        name: "Generic HTTP Dialer",
        type: DialerIntegrationType.GENERIC_HTTP,
        baseUrl: "https://dialer.example.com",
        apiKey: "changeme",
        settings: {
          startCallEndpoint: "/start",
          endCallEndpoint: "/end",
          webhookAuthHeader: "x-webhook-signature",
          webhookSecret: "changeme",
          phoneFieldPath: "lead.phone",
          externalCallIdPath: "call.id",
          eventTypePath: "event.type",
          eventTypeMappings: {},
        },
      },
    });

  const script = await prisma.script.create({
    data: {
      organizationId: org.id,
      key: "FEDERAL_CONTRACTING_STATEMENT",
      name: "Federal contracting statement",
      description: "Placeholder pending CMS-approved language",
      category: ScriptCategory.DISCLAIMER,
      applicableProductTypes: ["MA", "MAPD"],
      steps: {
        create: [
          {
            order: 1,
            key: "INTRO",
            content:
              "TODO: intro disclosure text pending legal review.",
            isRequired: true,
          },
          {
            order: 2,
            key: "BENEFITS",
            content: "TODO: benefits discussion guardrails.",
            isRequired: false,
          },
        ],
      },
    },
  });

  await prisma.scopeOfAppointment.create({
    data: {
      organizationId: org.id,
      leadId: (
        await prisma.lead.findFirst({
          where: { email: "ready@example.com" },
        })
      )!.id,
      agentId: agent.id,
      callSessionId: null,
      appointmentDate: new Date(),
      channel: ScopeOfAppointmentChannel.TELEPHONIC,
      productTypes: ["MA", "MAPD"],
      statementAcknowledged: true,
      signatureMethod:
        ScopeOfAppointmentSignatureMethod.ELECTRONIC,
      signatureEvidenceUrl: "https://example.com/soa",
      status: ScopeOfAppointmentStatus.SIGNED,
      signedAt: new Date(),
      expiresAt: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 365
      ),
    },
  });

  await prisma.task.create({
    data: {
      organizationId: org.id,
      leadId: (
        await prisma.lead.findFirst({
          where: { email: "ready@example.com" },
        })
      )!.id,
      assignedToUserId: agent.id,
      type: TaskType.CALL_BACK,
      status: TaskStatus.OPEN,
      priority: TaskPriority.MEDIUM,
      title: "Call ready lead",
      description: "Confirm SOA and proceed with disclosures",
      dueAt: new Date(
        Date.now() + 1000 * 60 * 60 * 24
      ),
    },
  });

  const callSession = await prisma.callSession.create({
    data: {
      organizationId: org.id,
      leadId: (
        await prisma.lead.findFirst({
          where: { email: "ready@example.com" },
        })
      )!.id,
      agentId: agent.id,
      dialerIntegrationId: dialerIntegration.id,
      externalCallId: "seed-call-1",
      direction: CallDirection.OUTBOUND,
      purpose: CallPurpose.MARKETING,
      status: CallStatus.INITIATED,
      complianceState: ComplianceState.SOA_COMPLETED,
    },
  });

  await prisma.enrollment.create({
    data: {
      organizationId: org.id,
      leadId: callSession.leadId,
      agentId: agent.id,
      callSessionId: callSession.id,
      planNameOrId: "Demo Plan",
      effectiveDate: new Date(),
      status: EnrollmentStatus.SUBMITTED,
    },
  });

  await prisma.enrollmentVerification.create({
    data: {
      enrollmentId: (
        await prisma.enrollment.findFirst({
          where: { leadId: callSession.leadId },
        })
      )!.id,
      method: EnrollmentVerificationMethod.PHONE,
      contactDetail: callSession.leadId,
      initiatedAt: new Date(),
      completedAt: null,
      outcome: EnrollmentVerificationOutcome.PENDING,
      notes: "Pending verification",
    },
  });

  // ---------------------------------------------------------------------------
  // Demo Medicare interactive call script (CallScript / CallScriptNode / Option)
  // ---------------------------------------------------------------------------

  const medicareCallScript =
    await prisma.callScript.upsert({
      where: { id: "demo-medicare-script" },
      update: {
        organizationId: org.id,
      },
      create: {
        id: "demo-medicare-script",
        organizationId: org.id,
        name: "Medicare T65 enrollment script (demo)",
        purpose: "MEDICARE_ENROLLMENT",
        description:
          "Demo skeleton for Medicare enrollment calls. Replace content with full CMS-approved script.",
        isActive: true,
        entryNodeId: null,
      },
    });

  // Intro node – greeting, permission, and scope
  const introNode = await prisma.callScriptNode.create({
    data: {
      scriptId: medicareCallScript.id,
      label: "Intro & permissions",
      content:
        "Hi, this is {{AGENT_NAME}} calling about your Medicare options. Before we continue, I need to confirm a few things:\n\n1) You requested information or gave us permission to contact you.\n2) This call may be recorded for quality and compliance.\n3) I’ll review your needs and, if appropriate, discuss plan options available in your area.\n\nDoes that sound okay, and are you ready to continue?",
      isTerminal: false,
    },
  });

  // Proceed node – brief placeholder for needs/benefits discussion
  const proceedNode = await prisma.callScriptNode.create({
    data: {
      scriptId: medicareCallScript.id,
      label: "Proceed to needs assessment",
      content:
        "Great. Next, I’ll ask a few questions to understand your current coverage, medications, and doctors so we can see which plans may fit your needs.\n\n[ASK NEEDS ASSESSMENT QUESTIONS HERE – medications, providers, budget, preferences.]",
      isTerminal: true,
    },
  });

  // Not interested / ineligible node – wrap-up
  const notInterestedNode =
    await prisma.callScriptNode.create({
      data: {
        scriptId: medicareCallScript.id,
        label: "Not interested / ineligible",
        content:
          "Thank you for your time today. Based on what you’ve shared, it doesn’t sound like now is the right time to make a change. If your situation changes or you’d like to review your options in the future, you can always contact us.\n\nHave a great day.",
        isTerminal: true,
      },
    });

  // Options from intro node
  await prisma.callScriptOption.create({
    data: {
      nodeId: introNode.id,
      label:
        "Lead confirms consent and is ready to proceed",
      nextNodeId: proceedNode.id,
    },
  });

  await prisma.callScriptOption.create({
    data: {
      nodeId: introNode.id,
      label:
        "Lead is not interested / not eligible / declines",
      nextNodeId: notInterestedNode.id,
    },
  });

  // Set the entry node
  await prisma.callScript.update({
    where: { id: medicareCallScript.id },
    data: {
      entryNodeId: introNode.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

