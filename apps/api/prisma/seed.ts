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

  // Set the entry node for the Medicare script
  await prisma.callScript.update({
    where: { id: medicareCallScript.id },
    data: {
      entryNodeId: introNode.id,
    },
  });

  // ---------------------------------------------------------------------------
  // Additional demo interactive call scripts
  // ---------------------------------------------------------------------------

  // 1) Warm intro: new Medicare lead
  const warmIntroScript = await prisma.callScript.upsert({
    where: { id: "demo-warm-intro-script" },
    update: {
      organizationId: org.id,
    },
    create: {
      id: "demo-warm-intro-script",
      organizationId: org.id,
      name: "Warm intro: new Medicare lead",
      purpose: "T65_WARM_INTRO",
      description:
        "Outbound warm introduction for newly referred Medicare leads.",
      isActive: true,
      entryNodeId: null,
    },
  });

  const warmIntroNode = await prisma.callScriptNode.create({
    data: {
      scriptId: warmIntroScript.id,
      label: "Warm intro & permission",
      content:
        "Hi, this is {{AGENT_NAME}} with {{ORG_NAME}}. You were recently referred to us to review your Medicare options.\n\nBefore we get started, I need to confirm:\n\n1) You’re the person we have on file, and you’re comfortable talking now.\n2) You’re giving permission to talk about Medicare plan options on this call.\n\nIs now still a good time to talk?",
      isTerminal: false,
    },
  });

  const warmIntroNextStepsNode =
    await prisma.callScriptNode.create({
      data: {
        scriptId: warmIntroScript.id,
        label: "Transition to needs assessment / follow-up",
        content:
          "Great. Next, we’ll review your current coverage, doctors, and medications so we can see which options may fit you best.\n\n[Use your standard discovery questions here.]\n\nIf at any point this doesn’t seem like a fit, tell me and we’ll stop.",
        isTerminal: true,
      },
    });

  await prisma.callScriptOption.create({
    data: {
      nodeId: warmIntroNode.id,
      label:
        "Lead is ready and gives permission to discuss options",
      nextNodeId: warmIntroNextStepsNode.id,
    },
  });

  await prisma.callScriptOption.create({
    data: {
      nodeId: warmIntroNode.id,
      label:
        "Lead is busy / not ready – set follow-up instead of continuing",
      nextNodeId: null,
    },
  });

  await prisma.callScript.update({
    where: { id: warmIntroScript.id },
    data: {
      entryNodeId: warmIntroNode.id,
    },
  });

  // 2) Annual Medicare plan review
  const annualReviewScript =
    await prisma.callScript.upsert({
      where: { id: "demo-annual-review-script" },
      update: {
        organizationId: org.id,
      },
      create: {
        id: "demo-annual-review-script",
        organizationId: org.id,
        name: "Annual Medicare plan review (demo)",
        purpose: "ANNUAL_REVIEW",
        description:
          "Framework for annual member check-in and benefit review.",
        isActive: true,
        entryNodeId: null,
      },
    });

  const annualIntroNode = await prisma.callScriptNode.create({
    data: {
      scriptId: annualReviewScript.id,
      label: "Annual review intro",
      content:
        "Hi, this is {{AGENT_NAME}} with {{ORG_NAME}}. I’m calling for your annual Medicare plan review.\n\nThe goal today is to:\n\n• Confirm your doctors and prescriptions are still correct.\n• Check if your current plan still fits your needs.\n• See whether any new options might be a better fit.\n\nIs it okay if we spend a few minutes reviewing your current situation?",
      isTerminal: false,
    },
  });

  const annualProceedNode =
    await prisma.callScriptNode.create({
      data: {
        scriptId: annualReviewScript.id,
        label: "Coverage review",
        content:
          "Perfect. Let’s walk through a quick checklist:\n\n1) Are you seeing any new doctors or specialists this year?\n2) Have there been any changes to your prescriptions or dosage?\n3) Have your monthly costs (premiums, copays, or pharmacy) become hard to manage?\n\n[Document key changes and confirm whether a plan review or change is appropriate under current rules.]",
        isTerminal: true,
      },
    });

  const annualNoChangeNode =
    await prisma.callScriptNode.create({
      data: {
        scriptId: annualReviewScript.id,
        label: "No changes / keep current plan",
        content:
          "Based on what you’ve shared, your current plan still appears to fit your doctors, medications, and budget.\n\nWe’ll keep your coverage as-is. If anything changes—new prescriptions, new doctors, or cost concerns—reach out so we can review again.",
        isTerminal: true,
      },
    });

  await prisma.callScriptOption.create({
    data: {
      nodeId: annualIntroNode.id,
      label:
        "Member has changes to doctors/meds/costs – review options",
      nextNodeId: annualProceedNode.id,
    },
  });

  await prisma.callScriptOption.create({
    data: {
      nodeId: annualIntroNode.id,
      label:
        "No major changes – confirm current plan still fits",
      nextNodeId: annualNoChangeNode.id,
    },
  });

  await prisma.callScript.update({
    where: { id: annualReviewScript.id },
    data: {
      entryNodeId: annualIntroNode.id,
    },
  });

  // 3) Post-enrollment welcome & check-in
  const postEnrollmentScript =
    await prisma.callScript.upsert({
      where: { id: "demo-post-enrollment-script" },
      update: {
        organizationId: org.id,
      },
      create: {
        id: "demo-post-enrollment-script",
        organizationId: org.id,
        name: "Post-enrollment welcome & check-in (demo)",
        purpose: "POST_ENROLLMENT_FOLLOWUP",
        description:
          "Short follow-up script after a new enrollment to confirm understanding and next steps.",
        isActive: true,
        entryNodeId: null,
      },
    });

  const postWelcomeNode = await prisma.callScriptNode.create({
    data: {
      scriptId: postEnrollmentScript.id,
      label: "Welcome & confirmation",
      content:
        "Hi, this is {{AGENT_NAME}} with {{ORG_NAME}}. I’m following up on your recent Medicare enrollment to make sure everything is clear and you know what to expect.\n\nFirst, I want to confirm you received your plan materials or card, or at least know when to expect them.",
      isTerminal: false,
    },
  });

  const postEducationNode =
    await prisma.callScriptNode.create({
      data: {
        scriptId: postEnrollmentScript.id,
        label: "Education & next steps",
        content:
          "Great. A couple of quick reminders:\n\n• Bring your new card to your doctor and pharmacy once it’s active.\n• Call the plan’s member services number for questions about bills or benefits.\n• If anything doesn’t look right or you have trouble using benefits, call us and we’ll help you review.\n\nIs there anything about your new coverage that feels unclear or worrying right now?",
        isTerminal: true,
      },
    });

  const postIssuesNode =
    await prisma.callScriptNode.create({
      data: {
        scriptId: postEnrollmentScript.id,
        label: "Issues or concerns",
        content:
          "Thanks for letting me know. Let’s talk through that concern and see whether it’s a normal part of how the plan works or something we need to escalate.\n\n[Document issue, timelines, and any follow-up actions in your CRM or task system.]",
        isTerminal: true,
      },
    });

  await prisma.callScriptOption.create({
    data: {
      nodeId: postWelcomeNode.id,
      label:
        "Member has received materials / understands timing",
      nextNodeId: postEducationNode.id,
    },
  });

  await prisma.callScriptOption.create({
    data: {
      nodeId: postWelcomeNode.id,
      label:
        "Member is confused, missing materials, or has concerns",
      nextNodeId: postIssuesNode.id,
    },
  });

  await prisma.callScript.update({
    where: { id: postEnrollmentScript.id },
    data: {
      entryNodeId: postWelcomeNode.id,
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

