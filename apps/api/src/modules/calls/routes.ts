// apps/api/src/modules/calls/routes.ts
//
// Call session routes with org + role-aware scoping.
//
// Roles (API/JWT):
//  - ADMIN
//  - MANAGER
//  - DIRECTOR
//  - AGENT
//  - COMPLIANCE_OFFICER (mapped from DB COMPLIANCE)
//  - VIEW_ONLY        (mapped from DB READ_ONLY)
//
// Visibility:
//  - ADMIN / COMPLIANCE_OFFICER / VIEW_ONLY: org-wide calls (read)
//  - DIRECTOR: calls for agents/managers under this director
//  - MANAGER: calls for this manager + their agents
//  - AGENT: calls where agentId === current user
//
// Manual logging (POST /api/calls) is allowed for:
//  - ADMIN / MANAGER / DIRECTOR / AGENT
//
// Dispositions (POST /api/calls/:id/disposition) are allowed for:
//  - ADMIN / MANAGER / DIRECTOR / AGENT / COMPLIANCE_OFFICER
//
// Coaching notes (POST /api/calls/:id/coaching) are allowed for:
//  - ADMIN / MANAGER / DIRECTOR / COMPLIANCE_OFFICER

import {
  Router,
  type Response,
  type NextFunction,
} from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { prisma } from "../../db/client";
import { recordAuditEvent } from "../audit/service";
import type {
  CallDirection,
  CallPurpose,
  CallStatus,
  LeadStatus,
} from "@prisma/client";
import {
  createTaskForLead,
  type ApiTaskStatus,
} from "../tasks/service";

export const callsRouter = Router();

// Canonical API roles we expect on req.user.role
type ApiRole =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTOR"
  | "AGENT"
  | "COMPLIANCE_OFFICER"
  | "VIEW_ONLY";

function normalizeRole(
  raw: string | null | undefined
): ApiRole | null {
  if (!raw) return null;
  const r = String(raw).toUpperCase();

  if (r === "ADMIN") return "ADMIN";
  if (r === "MANAGER") return "MANAGER";
  if (r === "DIRECTOR") return "DIRECTOR";
  if (r === "AGENT") return "AGENT";
  if (r === "COMPLIANCE" || r === "COMPLIANCE_OFFICER") {
    return "COMPLIANCE_OFFICER";
  }
  if (r === "READ_ONLY" || r === "VIEW_ONLY") {
    return "VIEW_ONLY";
  }

  return null;
}

/**
 * Compute the list of userIds (agents) whose calls a given user is allowed to see,
 * based on their role and the manager/director hierarchy.
 *
 * Returns:
 *  - null → no restriction (org-wide)
 *  - string[] → restrict to calls where agentId IN that list
 */
async function getAllowedAgentIdsForUser(params: {
  organizationId: string;
  userId: string;
  role: ApiRole | null;
}): Promise<string[] | null> {
  const { organizationId, userId, role } = params;

  if (!role) {
    // Defensive: unknown role → self only
    return [userId];
  }

  // Org-wide roles
  if (
    role === "ADMIN" ||
    role === "COMPLIANCE_OFFICER" ||
    role === "VIEW_ONLY"
  ) {
    return null;
  }

  // Agents only see their own calls
  if (role === "AGENT") {
    return [userId];
  }

  // Managers see their calls + their agents' calls
  if (role === "MANAGER") {
    const agents = await prisma.user.findMany({
      where: {
        organizationId,
        managerId: userId,
      },
      select: { id: true },
    });
    return [userId, ...agents.map((a) => a.id)];
  }

  // Directors see their calls + managers + agents under them
  if (role === "DIRECTOR") {
    const managers = await prisma.user.findMany({
      where: {
        organizationId,
        directorId: userId,
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    const agents = await prisma.user.findMany({
      where: {
        organizationId,
        managerId: {
          in: managerIds.length > 0 ? managerIds : ["__none__"],
        },
      },
      select: { id: true },
    });
    const agentIds = agents.map((a) => a.id);

    return [userId, ...managerIds, ...agentIds];
  }

  // Fallback: restrict to self
  return [userId];
}

/**
 * POST /api/calls
 *
 * Manually log a call session for a lead.
 * Allowed roles: ADMIN, MANAGER, DIRECTOR, AGENT.
 *
 * Body:
 *  - leadId (string, required)
 *  - direction ("INBOUND" | "OUTBOUND", required)
 *  - purpose ("EDUCATION" | "MARKETING" | "ENROLLMENT" | "SERVICE", required)
 *  - status (optional; CallStatus enum, defaults to "COMPLETED")
 *  - externalCallId (optional)
 *  - startedAt / connectedAt / endedAt (optional ISO strings)
 */
callsRouter.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const agentId = user.id;
      const role = normalizeRole(user.role as string | undefined);

      if (
        !role ||
        !["ADMIN", "MANAGER", "DIRECTOR", "AGENT"].includes(role)
      ) {
        res.status(403).json({ error: "Not authorized to log calls" });
        return;
      }

      const {
        leadId,
        direction,
        purpose,
        status,
        externalCallId,
        startedAt,
        connectedAt,
        endedAt,
      } = req.body ?? {};

      if (!leadId || typeof leadId !== "string") {
        res.status(400).json({ error: "leadId is required" });
        return;
      }

      if (!direction || typeof direction !== "string") {
        res.status(400).json({ error: "direction is required" });
        return;
      }

      if (!purpose || typeof purpose !== "string") {
        res.status(400).json({ error: "purpose is required" });
        return;
      }

      const allowedDirections: CallDirection[] = ["INBOUND", "OUTBOUND"];
      const allowedPurposes: CallPurpose[] = [
        "EDUCATION",
        "MARKETING",
        "ENROLLMENT",
        "SERVICE",
      ];
      const allowedStatuses: CallStatus[] = [
        "INITIATED",
        "RINGING",
        "CONNECTED",
        "FAILED",
        "COMPLETED",
        "ABANDONED",
      ];

      if (!allowedDirections.includes(direction as CallDirection)) {
        res.status(400).json({
          error: `direction must be one of: ${allowedDirections.join(", ")}`,
        });
        return;
      }

      if (!allowedPurposes.includes(purpose as CallPurpose)) {
        res.status(400).json({
          error: `purpose must be one of: ${allowedPurposes.join(", ")}`,
        });
        return;
      }

      const finalStatus: CallStatus =
        typeof status === "string" &&
        allowedStatuses.includes(status as CallStatus)
          ? (status as CallStatus)
          : "COMPLETED";

      // Ensure the lead belongs to this org
      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId: orgId,
        },
      });

      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }

      // Pick an existing dialer integration or create a manual one per org
      let dialer = await prisma.dialerIntegration.findFirst({
        where: {
          organizationId: orgId,
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (!dialer) {
        dialer = await prisma.dialerIntegration.create({
          data: {
            organizationId: orgId,
            name: "Manual logging",
            type: "GENERIC_HTTP",
            baseUrl: "",
            apiKey: null,
            settings: {},
            isActive: true,
          } as any,
        });
      }

      const now = new Date();

      function parseDateOrNull(input: unknown): Date | null {
        if (!input || typeof input !== "string") return null;
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) return null;
        return d;
      }

      const startedAtDate = parseDateOrNull(startedAt) ?? now;
      const connectedAtDate = parseDateOrNull(connectedAt);
      const endedAtDate = parseDateOrNull(endedAt) ?? now;

      const call = await prisma.callSession.create({
        data: {
          organizationId: orgId,
          leadId: lead.id,
          agentId,
          dialerIntegrationId: dialer.id,
          externalCallId:
            typeof externalCallId === "string" &&
            externalCallId.trim().length > 0
              ? externalCallId.trim()
              : `MANUAL-${Date.now()}`,
          direction: direction as CallDirection,
          purpose: purpose as CallPurpose,
          status: finalStatus,
          complianceState: "PRE_CALL_CHECKS_PENDING",
          startedAt: startedAtDate,
          connectedAt: connectedAtDate,
          endedAt: endedAtDate,
          recordingUrl: null,
        },
      });

      await recordAuditEvent({
        userId: agentId,
        leadId: lead.id,
        eventType: "CALL_LOGGED_MANUAL",
        eventData: {
          callId: call.id,
          direction: call.direction,
          purpose: call.purpose,
          status: call.status,
        },
      });

      res.status(201).json({
        id: call.id,
        organizationId: call.organizationId,
        leadId: call.leadId,
        agentId: call.agentId,
        dialerIntegrationId: call.dialerIntegrationId,
        externalCallId: call.externalCallId,
        direction: call.direction,
        purpose: call.purpose,
        status: call.status,
        complianceState: call.complianceState,
        startedAt: call.startedAt
          ? call.startedAt.toISOString()
          : null,
        connectedAt: call.connectedAt
          ? call.connectedAt.toISOString()
          : null,
        endedAt: call.endedAt ? call.endedAt.toISOString() : null,
        recordingUrl: call.recordingUrl ?? null,
        createdAt: call.createdAt.toISOString(),
        updatedAt: call.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/calls
 *
 * List call sessions visible to the current user (org + role scoped).
 * Optional query params:
 *   ?leadId=...   → filter calls for a single lead
 *   ?limit=...    → max rows (default 50, max 200)
 */
callsRouter.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);

      const { leadId, limit: limitRaw } = req.query;

      const allowedAgents = await getAllowedAgentIdsForUser({
        organizationId: orgId,
        userId,
        role,
      });

      let limit = 50;
      if (typeof limitRaw === "string") {
        const parsed = parseInt(limitRaw, 10);
        if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 200) {
          limit = parsed;
        }
      }

      const where: any = {
        organizationId: orgId,
      };

      if (typeof leadId === "string" && leadId.trim()) {
        where.leadId = leadId.trim();
      }

      if (allowedAgents) {
        where.agentId = { in: allowedAgents };
      }

      const calls = await prisma.callSession.findMany({
        where,
        orderBy: {
          startedAt: "desc",
        },
        take: limit,
      });

      const payload = calls.map((c) => ({
        id: c.id,
        organizationId: c.organizationId,
        leadId: c.leadId,
        agentId: c.agentId,
        dialerIntegrationId: c.dialerIntegrationId,
        externalCallId: c.externalCallId,
        direction: c.direction,
        purpose: c.purpose,
        status: c.status,
        complianceState: c.complianceState,
        startedAt: c.startedAt ? c.startedAt.toISOString() : null,
        connectedAt: c.connectedAt
          ? c.connectedAt.toISOString()
          : null,
        endedAt: c.endedAt ? c.endedAt.toISOString() : null,
        recordingUrl: c.recordingUrl ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));

      res.json({ calls: payload });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Helper to fetch a single call session visible to the current user
 * under org + role-aware scoping.
 */
async function getCallVisibleToUser(params: {
  organizationId: string;
  userId: string;
  role: ApiRole | null;
  callId: string;
}) {
  const { organizationId, userId, role, callId } = params;

  const allowedAgents = await getAllowedAgentIdsForUser({
    organizationId,
    userId,
    role,
  });

  const where: any = {
    id: callId,
    organizationId,
  };

  if (allowedAgents) {
    where.agentId = { in: allowedAgents };
  }

  return prisma.callSession.findFirst({ where });
}

/**
 * GET /api/calls/:id
 *
 * Fetch a single call session, scoped by org + role.
 */
callsRouter.get(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      const call = await getCallVisibleToUser({
        organizationId: orgId,
        userId,
        role,
        callId: id,
      });

      if (!call) {
        res.status(404).json({ error: "Call not found" });
        return;
      }

      res.json({
        id: call.id,
        organizationId: call.organizationId,
        leadId: call.leadId,
        agentId: call.agentId,
        dialerIntegrationId: call.dialerIntegrationId,
        externalCallId: call.externalCallId,
        direction: call.direction,
        purpose: call.purpose,
        status: call.status,
        complianceState: call.complianceState,
        startedAt: call.startedAt ? call.startedAt.toISOString() : null,
        connectedAt: call.connectedAt
          ? call.connectedAt.toISOString()
          : null,
        endedAt: call.endedAt ? call.endedAt.toISOString() : null,
        recordingUrl: call.recordingUrl ?? null,
        createdAt: call.createdAt.toISOString(),
        updatedAt: call.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Decide what lead status should become after a given call disposition.
 * Returns null if we should leave status unchanged.
 */
function getLeadStatusAfterDisposition(opts: {
  currentStatus: LeadStatus;
  disposition:
    | "NO_ANSWER"
    | "LEFT_VOICEMAIL"
    | "CALLBACK"
    | "NOT_INTERESTED"
    | "QUALIFIED"
    | "TRANSFERRED"
    | "INVALID_NUMBER"
    | "OTHER";
}): LeadStatus | null {
  const { currentStatus, disposition } = opts;

  // If already enrolled or DNC, we generally don't auto-downgrade,
  // except for explicit "NOT_INTERESTED" or "INVALID_NUMBER".
  if (currentStatus === "ENROLLED" || currentStatus === "DO_NOT_CONTACT") {
    if (disposition === "NOT_INTERESTED") return "NOT_INTERESTED";
    if (disposition === "INVALID_NUMBER") return "DO_NOT_CONTACT";
    return null;
  }

  switch (disposition) {
    case "NO_ANSWER":
    case "LEFT_VOICEMAIL":
    case "CALLBACK":
      if (currentStatus === "NEW") {
        return "CONTACT_ATTEMPTED";
      }
      return null;

    case "QUALIFIED":
      if (
        currentStatus === "NEW" ||
        currentStatus === "CONTACT_ATTEMPTED" ||
        currentStatus === "CONTACTED"
      ) {
        return "IN_DISCUSSION";
      }
      return null;

    case "NOT_INTERESTED":
      return "NOT_INTERESTED";

    case "INVALID_NUMBER":
      return "DO_NOT_CONTACT";

    case "TRANSFERRED":
      if (currentStatus === "NEW") {
        return "CONTACTED";
      }
      if (currentStatus === "CONTACT_ATTEMPTED") {
        return "CONTACTED";
      }
      return null;

    case "OTHER":
    default:
      return null;
  }
}

/**
 * POST /api/calls/:id/disposition
 *
 * Record a disposition for a call and optionally create a follow-up task.
 * Also applies automated lead status transitions based on disposition.
 *
 * Allowed roles: ADMIN, MANAGER, DIRECTOR, AGENT, COMPLIANCE_OFFICER.
 *
 * Body:
 *  {
 *    disposition: "NO_ANSWER" | "LEFT_VOICEMAIL" | "CALLBACK" | "NOT_INTERESTED" | "QUALIFIED" | "TRANSFERRED" | "INVALID_NUMBER" | "OTHER",
 *    callbackAt?: string,
 *    notes?: string
 *  }
 */
callsRouter.post(
  "/:id/disposition",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      if (
        !role ||
        ![
          "ADMIN",
          "MANAGER",
          "DIRECTOR",
          "AGENT",
          "COMPLIANCE_OFFICER",
        ].includes(role)
      ) {
        res.status(403).json({
          error: "Not authorized to record call dispositions",
        });
        return;
      }

      const { disposition, callbackAt, notes } = req.body ?? {};

      const allowedDispositions = [
        "NO_ANSWER",
        "LEFT_VOICEMAIL",
        "CALLBACK",
        "NOT_INTERESTED",
        "QUALIFIED",
        "TRANSFERRED",
        "INVALID_NUMBER",
        "OTHER",
      ] as const;

      if (
        !disposition ||
        typeof disposition !== "string" ||
        !allowedDispositions.includes(disposition as any)
      ) {
        res.status(400).json({
          error: `disposition must be one of: ${allowedDispositions.join(
            ", "
          )}`,
        });
        return;
      }

      const call = await getCallVisibleToUser({
        organizationId: orgId,
        userId,
        role,
        callId: id,
      });

      if (!call) {
        res.status(404).json({ error: "Call not found or not visible" });
        return;
      }

      // Compute dueAt for follow-up if needed
      function parseDateOrNull(input: unknown): Date | null {
        if (!input || typeof input !== "string") return null;
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) return null;
        return d;
      }

      let dueAt: Date | null = parseDateOrNull(callbackAt);

      const now = new Date();
      const createFollowUpTask =
        disposition === "NO_ANSWER" ||
        disposition === "LEFT_VOICEMAIL" ||
        disposition === "CALLBACK";

      if (!dueAt && createFollowUpTask) {
        // simple default: tomorrow
        const tomorrow = new Date(now.getTime());
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueAt = tomorrow;
      }

      let createdTaskId: string | null = null;

      if (createFollowUpTask && dueAt) {
        const title = `Callback (${disposition.replace("_", " ")})`;
        const description =
          typeof notes === "string" && notes.trim().length > 0
            ? notes.trim()
            : `Auto-created follow-up from call disposition ${disposition}`;

        const task = await createTaskForLead({
          organizationId: orgId,
          leadId: call.leadId,
          assignedToUserId: call.agentId,
          title,
          description,
          status: "OPEN" as ApiTaskStatus,
          dueAt,
        });

        createdTaskId = task.id;
      }

      // Automated lead status transition
      const lead = await prisma.lead.findFirst({
        where: {
          id: call.leadId,
          organizationId: orgId,
        },
      });

      let newLeadStatus: LeadStatus | null = null;

      if (lead) {
        newLeadStatus = getLeadStatusAfterDisposition({
          currentStatus: lead.status as LeadStatus,
          disposition: disposition as any,
        });

        if (newLeadStatus && newLeadStatus !== lead.status) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              status: newLeadStatus,
            },
          });
        }
      }

      await recordAuditEvent({
        userId,
        leadId: call.leadId,
        eventType: "CALL_DISPOSITION_RECORDED",
        eventData: {
          callId: call.id,
          disposition,
          callbackAt: dueAt ? dueAt.toISOString() : null,
          notes: typeof notes === "string" ? notes.trim() : null,
          createdTaskId,
          previousLeadStatus: lead?.status ?? null,
          newLeadStatus: newLeadStatus ?? null,
        },
      });

      res.status(201).json({
        callId: call.id,
        disposition,
        callbackAt: dueAt ? dueAt.toISOString() : null,
        createdTaskId,
        newLeadStatus: newLeadStatus ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/calls/:id/coaching
 *
 * Create a coaching note for a call.
 * Roles allowed: ADMIN, MANAGER, DIRECTOR, COMPLIANCE_OFFICER.
 *
 * Body: { score?: number; notes: string }
 */
callsRouter.post(
  "/:id/coaching",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const coachUserId = user.id;
      const role = normalizeRole(user.role as string | undefined);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      if (
        !role ||
        !["ADMIN", "MANAGER", "DIRECTOR", "COMPLIANCE_OFFICER"].includes(
          role
        )
      ) {
        res
          .status(403)
          .json({ error: "Not authorized to add coaching notes" });
        return;
      }

      const { score, notes } = req.body ?? {};
      if (!notes || typeof notes !== "string" || !notes.trim()) {
        res.status(400).json({ error: "Coaching notes are required" });
        return;
      }

      let numericScore: number | null = null;
      if (score !== undefined && score !== null) {
        const parsed = Number(score);
        if (Number.isNaN(parsed)) {
          res.status(400).json({ error: "score must be a number" });
          return;
        }
        if (parsed < 0 || parsed > 100) {
          res
            .status(400)
            .json({ error: "score must be between 0 and 100" });
          return;
        }
        numericScore = parsed;
      }

      const call = await getCallVisibleToUser({
        organizationId: orgId,
        userId: coachUserId,
        role,
        callId: id,
      });

      if (!call) {
        res.status(404).json({ error: "Call not found or not visible" });
        return;
      }

      await recordAuditEvent({
        userId: coachUserId,
        leadId: call.leadId,
        eventType: "CALL_COACHING_NOTE",
        eventData: {
          callId: call.id,
          score: numericScore,
          notes: notes.trim(),
        },
      });

      const createdAt = new Date();

      res.status(201).json({
        id: `coaching-${createdAt.getTime()}`,
        callId: call.id,
        score: numericScore,
        notes: notes.trim(),
        createdAt: createdAt.toISOString(),
        coachUserId,
        coachName: null,
        coachEmail: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/calls/:id/coaching
 *
 * List coaching notes for a call.
 */
callsRouter.get(
  "/:id/coaching",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }

      const call = await getCallVisibleToUser({
        organizationId: orgId,
        userId,
        role,
        callId: id,
      });

      if (!call) {
        res.status(404).json({ error: "Call not found or not visible" });
        return;
      }

      const events = await prisma.auditEvent.findMany({
        where: {
          organizationId: orgId,
          eventType: "CALL_COACHING_NOTE",
          metadata: {
            path: ["callId"],
            equals: call.id,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const notes = events.map((e) => {
        const md = (e.metadata ?? {}) as any;
        return {
          id: e.id,
          callId: md.callId ?? call.id,
          score:
            typeof md.score === "number" ? (md.score as number) : null,
          notes: String(md.notes ?? ""),
          createdAt: e.createdAt.toISOString(),
          coachUserId: e.actorUserId ?? null,
          coachName: e.actor
            ? `${e.actor.firstName} ${e.actor.lastName}`
            : null,
          coachEmail: e.actor?.email ?? null,
        };
      });

      res.json({ notes });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/calls/coaching-queue/list
 *
 * List calls that have coaching notes, scoped by org + role.
 * Optional query params:
 *   ?limit=...   → max rows (default 50, max 200)
 */
callsRouter.get(
  "/coaching-queue/list",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orgId = user.organizationId;
      const userId = user.id;
      const role = normalizeRole(user.role as string | undefined);

      const allowedAgents = await getAllowedAgentIdsForUser({
        organizationId: orgId,
        userId,
        role,
      });

      const limitRaw = req.query.limit;
      let limit = 50;
      if (typeof limitRaw === "string") {
        const parsed = parseInt(limitRaw, 10);
        if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 200) {
          limit = parsed;
        }
      }

      // Recent coaching events
      const coachingEvents = await prisma.auditEvent.findMany({
        where: {
          organizationId: orgId,
          eventType: "CALL_COACHING_NOTE",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 500,
      });

      const callIdSet = new Set<string>();
      for (const e of coachingEvents) {
        const md = (e.metadata ?? {}) as any;
        const cid = md.callId;
        if (typeof cid === "string") {
          callIdSet.add(cid);
        }
      }

      const callIds = Array.from(callIdSet);
      if (callIds.length === 0) {
        res.json({ items: [] });
        return;
      }

      const calls = await prisma.callSession.findMany({
        where: {
          organizationId: orgId,
          id: { in: callIds },
          ...(allowedAgents
            ? {
                agentId: {
                  in: allowedAgents,
                },
              }
            : {}),
        },
      });

      if (calls.length === 0) {
        res.json({ items: [] });
        return;
      }

      const callMap = new Map<string, (typeof calls)[number]>();
      for (const c of calls) {
        callMap.set(c.id, c);
      }

      // Aggregate coaching info per call
      const perCall: Record<
        string,
        {
          lastCoachedAt: Date;
          lastScore: number | null;
          noteCount: number;
        }
      > = {};

      for (const e of coachingEvents) {
        const md = (e.metadata ?? {}) as any;
        const cid = md.callId;
        if (typeof cid !== "string") continue;
        const call = callMap.get(cid);
        if (!call) continue;

        let rec = perCall[cid];
        if (!rec) {
          rec = {
            lastCoachedAt: e.createdAt,
            lastScore:
              typeof md.score === "number" && !Number.isNaN(md.score)
                ? (md.score as number)
                : null,
            noteCount: 1,
          };
          perCall[cid] = rec;
        } else {
          rec.noteCount += 1;
          // events ordered desc; first wins for lastCoachedAt/score
        }
      }

      const items = Object.entries(perCall)
        .map(([cid, info]) => {
          const c = callMap.get(cid)!;
          return {
            callId: c.id,
            leadId: c.leadId,
            agentId: c.agentId,
            direction: c.direction,
            purpose: c.purpose,
            status: c.status,
            startedAt: c.startedAt ? c.startedAt.toISOString() : null,
            lastCoachedAt: info.lastCoachedAt.toISOString(),
            lastScore: info.lastScore,
            noteCount: info.noteCount,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.lastCoachedAt).getTime() -
            new Date(a.lastCoachedAt).getTime()
        )
        .slice(0, limit);

      res.json({ items });
    } catch (err) {
      next(err);
    }
  }
);

