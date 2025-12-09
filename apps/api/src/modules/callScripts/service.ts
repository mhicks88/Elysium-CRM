// apps/api/src/modules/callScripts/service.ts
//
// Core service layer for Interactive Call Scripts.
// Handles reading scripts, starting runs, stepping through nodes,
// and ending runs. DB access is via Prisma.
//
// Phase 0: just enough to drive an interactive script UI
// on the Lead Detail page and an admin list/inspection.

import { prisma } from "../../db/client";

export type ScriptRunStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface ScriptNodeDTO {
  id: string;
  label: string | null;
  content: string;
  isTerminal: boolean;
  options: {
    id: string;
    label: string;
    nextNodeId: string | null;
  }[];
}

export interface CallScriptDTO {
  id: string;
  name: string;
  purpose: string;
  description: string | null;
  isActive: boolean;
  entryNodeId: string | null;
  nodes: ScriptNodeDTO[];
}

/**
 * List active scripts for an organization, optionally filtered by purpose.
 */
export async function listActiveScriptsForOrg(params: {
  organizationId: string;
  purpose?: string;
}): Promise<CallScriptDTO[]> {
  const { organizationId, purpose } = params;

  const scripts = await prisma.callScript.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(purpose ? { purpose } : {}),
    },
    include: {
      nodes: {
        include: {
          options: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return scripts.map((s: any) => ({
    id: s.id,
    name: s.name,
    purpose: s.purpose,
    description: s.description ?? null,
    isActive: s.isActive,
    entryNodeId: s.entryNodeId,
    nodes: s.nodes.map((n: any) => ({
      id: n.id,
      label: n.label,
      content: n.content,
      isTerminal: n.isTerminal,
      options: n.options.map((o: any) => ({
        id: o.id,
        label: o.label,
        nextNodeId: o.nextNodeId,
      })),
    })),
  }));
}

/**
 * Get a single script with its nodes/options, ensuring it belongs to the org.
 */
export async function getScriptById(params: {
  organizationId: string;
  scriptId: string;
}): Promise<CallScriptDTO | null> {
  const { organizationId, scriptId } = params;

  const s = await prisma.callScript.findFirst({
    where: {
      id: scriptId,
      organizationId,
    },
    include: {
      nodes: {
        include: {
          options: true,
        },
      },
    },
  });

  if (!s) {
    return null;
  }

  return {
    id: s.id,
    name: s.name,
    purpose: s.purpose,
    description: s.description ?? null,
    isActive: s.isActive,
    entryNodeId: s.entryNodeId,
    nodes: s.nodes.map((n: any) => ({
      id: n.id,
      label: n.label,
      content: n.content,
      isTerminal: n.isTerminal,
      options: n.options.map((o: any) => ({
        id: o.id,
        label: o.label,
        nextNodeId: o.nextNodeId,
      })),
    })),
  };
}

/**
 * Find the default active script for an org+purpose.
 * If multiple exist, returns the most recently created.
 */
export async function resolveScriptForPurpose(params: {
  organizationId: string;
  purpose: string;
}): Promise<CallScriptDTO | null> {
  const { organizationId, purpose } = params;

  const s = await prisma.callScript.findFirst({
    where: {
      organizationId,
      purpose,
      isActive: true,
    },
    include: {
      nodes: {
        include: {
          options: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!s) return null;

  return {
    id: s.id,
    name: s.name,
    purpose: s.purpose,
    description: s.description ?? null,
    isActive: s.isActive,
    entryNodeId: s.entryNodeId,
    nodes: s.nodes.map((n: any) => ({
      id: n.id,
      label: n.label,
      content: n.content,
      isTerminal: n.isTerminal,
      options: n.options.map((o: any) => ({
        id: o.id,
        label: o.label,
        nextNodeId: o.nextNodeId,
      })),
    })),
  };
}

/**
 * Start a new script run for a lead & agent.
 *
 * Typically called from: "Start Scripted Call" on Lead Detail.
 */
export async function startScriptRun(params: {
  organizationId: string;
  scriptId: string;
  leadId: string;
  agentId: string;
}): Promise<{
  runId: string;
  script: CallScriptDTO;
  currentNode: ScriptNodeDTO | null;
}> {
  const { organizationId, scriptId, leadId, agentId } = params;

  // Ensure script belongs to org
  const script = await getScriptById({ organizationId, scriptId });
  if (!script || !script.isActive) {
    throw new Error(
      "Script not found or inactive for this organization."
    );
  }

  if (!script.entryNodeId) {
    throw new Error("Script is missing an entryNodeId.");
  }

  const run = await prisma.callScriptRun.create({
    data: {
      organizationId,
      scriptId,
      leadId,
      agentId,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  const currentNode =
    script.nodes.find(
      (n: ScriptNodeDTO) => n.id === script.entryNodeId
    ) ?? null;

  return {
    runId: run.id,
    script,
    currentNode,
  };
}

/**
 * Advance a script run by selecting an option from the current node.
 *
 * Returns the new current node (or null if script ended).
 */
export async function stepScriptRun(params: {
  runId: string;
  optionId: string;
}): Promise<{
  runId: string;
  status: ScriptRunStatus;
  currentNode: ScriptNodeDTO | null;
}> {
  const { runId, optionId } = params;

  const run = await prisma.callScriptRun.findUnique({
    where: { id: runId },
    include: {
      script: {
        include: {
          nodes: { include: { options: true } },
        },
      },
    },
  });

  if (!run) {
    throw new Error("Script run not found.");
  }

  if (run.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot step a script run that is not IN_PROGRESS."
    );
  }

  // Find the node/option in the script definition
  const allNodes = run.script.nodes;
  const optionNode = allNodes
    .flatMap((n: any) =>
      n.options.map((o: any) => ({
        node: n as any,
        option: o as any,
      }))
    )
    .find(
      ({ option }: { option: any }) => option.id === optionId
    );

  if (!optionNode) {
    throw new Error("Option not found in script.");
  }

  const { node, option } = optionNode as {
    node: any;
    option: any;
  };

  // Record the step
  await prisma.callScriptRunStep.create({
    data: {
      runId: run.id,
      nodeId: node.id,
      optionId: option.id,
    },
  });

  // Determine the next node
  const nextNode =
    option.nextNodeId != null
      ? (allNodes.find(
          (n: any) => n.id === option.nextNodeId
        ) ?? null)
      : null;

  // If there's no next node or it's terminal, mark as completed
  let newStatus: ScriptRunStatus =
    run.status as ScriptRunStatus;

  if (!nextNode || nextNode.isTerminal) {
    newStatus = "COMPLETED";

    await prisma.callScriptRun.update({
      where: { id: run.id },
      data: {
        status: newStatus,
        endedAt: new Date(),
      },
    });
  }

  const currentNodeDTO: ScriptNodeDTO | null = nextNode
    ? {
        id: nextNode.id,
        label: nextNode.label,
        content: nextNode.content,
        isTerminal: nextNode.isTerminal,
        options: nextNode.options.map((o: any) => ({
          id: o.id,
          label: o.label,
          nextNodeId: o.nextNodeId,
        })),
      }
    : null;

  return {
    runId: run.id,
    status: newStatus,
    currentNode: currentNodeDTO,
  };
}

/**
 * End a script run explicitly (e.g., agent abandons, or sets outcome).
 */
export async function endScriptRun(params: {
  runId: string;
  outcome?: string | null;
  status?: ScriptRunStatus; // default: "COMPLETED"
}): Promise<void> {
  const { runId, outcome, status } = params;

  const newStatus: ScriptRunStatus = status ?? "COMPLETED";

  await prisma.callScriptRun.update({
    where: { id: runId },
    data: {
      status: newStatus,
      outcome: outcome ?? null,
      endedAt: new Date(),
    },
  });
}

/**
 * Get prior runs for a lead (for history in Lead Detail / Compliance).
 */
export async function getScriptRunsForLead(params: {
  organizationId: string;
  leadId: string;
  limit?: number;
}): Promise<
  {
    id: string;
    scriptId: string;
    scriptName: string;
    purpose: string;
    status: string;
    outcome: string | null;
    startedAt: Date;
    endedAt: Date | null;
    agentId: string;
  }[]
> {
  const { organizationId, leadId, limit = 50 } = params;

  const runs = await prisma.callScriptRun.findMany({
    where: {
      organizationId,
      leadId,
    },
    include: {
      script: true,
    },
    orderBy: {
      startedAt: "desc",
    },
    take: limit,
  });

  return runs.map((r: any) => ({
    id: r.id,
    scriptId: r.scriptId,
    scriptName: r.script.name,
    purpose: r.script.purpose,
    status: r.status,
    outcome: r.outcome,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    agentId: r.agentId,
  }));
}

// -----------------------------------------------------------------------------
// Demo Medicare script helper per org
// -----------------------------------------------------------------------------

export async function ensureDemoMedicareScriptForOrg(
  organizationId: string
): Promise<CallScriptDTO> {
  // If it already exists for this org, just return it
  const existing = await prisma.callScript.findFirst({
    where: {
      organizationId,
      name: "Medicare T65 enrollment script (demo)",
      purpose: "MEDICARE_ENROLLMENT",
    },
    include: {
      nodes: {
        include: { options: true },
      },
    },
  });

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      purpose: existing.purpose,
      description: existing.description ?? null,
      isActive: existing.isActive,
      entryNodeId: existing.entryNodeId,
      nodes: existing.nodes.map((n: any) => ({
        id: n.id,
        label: n.label,
        content: n.content,
        isTerminal: n.isTerminal,
        options: n.options.map((o: any) => ({
          id: o.id,
          label: o.label,
          nextNodeId: o.nextNodeId,
        })),
      })),
    };
  }

  // Otherwise, create a new demo script for this org
  const script = await prisma.callScript.create({
    data: {
      organizationId,
      name: "Medicare T65 enrollment script (demo)",
      purpose: "MEDICARE_ENROLLMENT",
      description:
        "Demo skeleton for Medicare enrollment calls. Replace with CMS-approved language.",
      isActive: true,
      entryNodeId: null,
    },
  });

  const introNode = await prisma.callScriptNode.create({
    data: {
      scriptId: script.id,
      label: "Intro & permissions",
      content:
        "Hi, this is {{AGENT_NAME}} calling about your Medicare options. Before we continue, I need to confirm a few things:\n\n1) You requested information or gave us permission to contact you.\n2) This call may be recorded for quality and compliance.\n3) I’ll review your needs and, if appropriate, discuss plan options available in your area.\n\nDoes that sound okay, and are you ready to continue?",
      isTerminal: false,
    },
  });

  const proceedNode = await prisma.callScriptNode.create({
    data: {
      scriptId: script.id,
      label: "Proceed to needs assessment",
      content:
        "Great. Next, I’ll ask a few questions to understand your current coverage, medications, and doctors so we can see which plans may fit your needs.\n\n[ASK NEEDS ASSESSMENT QUESTIONS HERE.]",
      isTerminal: true,
    },
  });

  const notInterestedNode = await prisma.callScriptNode.create({
    data: {
      scriptId: script.id,
      label: "Not interested / ineligible",
      content:
        "Thank you for your time today. Based on what you’ve shared, it doesn’t sound like now is the right time to make a change. If your situation changes or you’d like to review your options in the future, you can always contact us.\n\nHave a great day.",
      isTerminal: true,
    },
  });

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

  const updatedScript = await prisma.callScript.update({
    where: { id: script.id },
    data: {
      entryNodeId: introNode.id,
    },
    include: {
      nodes: { include: { options: true } },
    },
  });

  return {
    id: updatedScript.id,
    name: updatedScript.name,
    purpose: updatedScript.purpose,
    description: updatedScript.description ?? null,
    isActive: updatedScript.isActive,
    entryNodeId: updatedScript.entryNodeId,
    nodes: updatedScript.nodes.map((n: any) => ({
      id: n.id,
      label: n.label,
      content: n.content,
      isTerminal: n.isTerminal,
      options: n.options.map((o: any) => ({
        id: o.id,
        label: o.label,
        nextNodeId: o.nextNodeId,
      })),
    })),
  };
}

