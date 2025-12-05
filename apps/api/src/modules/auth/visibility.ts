// apps/api/src/modules/auth/visibility.ts
//
// Helper for role-aware visibility of users for reporting / scoping.
//
// This is used to determine which users' data (calls, compliance checks,
// leads, etc.) a given logged-in user is allowed to see in aggregate
// reports or dashboards.

import { prisma } from "../../db/client";
import type { UserRole } from "@prisma/client";

/**
 * Minimal shape we need from the authenticated user.
 *
 * NOTE: This is intentionally *not* the full Prisma User type, so that it
 * accepts the AuthenticatedUser shape from middleware/auth (which at least
 * includes `id` and `role`).
 */
export type UserLike = {
  id: string;
  role: UserRole;
};

/**
 * Return the list of user IDs whose data the given user
 * is allowed to see in reports.
 *
 * Rules:
 *  - ADMIN / COMPLIANCE: all users in the organization
 *  - MANAGER: the manager themselves + all agents where managerId = manager.id
 *  - DIRECTOR: the director themselves + all managers where directorId = director.id
 *              + all agents managed by those managers
 *  - Everyone else: just themselves (AGENT, READ_ONLY, etc.)
 *
 * We look up the full User record via Prisma to get organizationId,
 * managerId, directorId, etc.
 */
export async function getVisibleUserIdsForUser(
  user: UserLike
): Promise<string[]> {
  if (!user) return [];

  // Load full DB user so we can see org, manager/director relationships.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) {
    // Fallback: if we can't find the user in DB, restrict to self.
    return [user.id];
  }

  switch (dbUser.role) {
    case "ADMIN":
    case "COMPLIANCE": {
      // Org-wide visibility
      const users = await prisma.user.findMany({
        where: {
          organizationId: dbUser.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    case "MANAGER": {
      // Manager + their agents
      const users = await prisma.user.findMany({
        where: {
          organizationId: dbUser.organizationId,
          isActive: true,
          OR: [
            { id: dbUser.id }, // the manager
            { managerId: dbUser.id }, // agents under this manager
          ],
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    case "DIRECTOR": {
      // Director + managers they oversee + those managers' agents
      const managers = await prisma.user.findMany({
        where: {
          organizationId: dbUser.organizationId,
          isActive: true,
          directorId: dbUser.id,
        },
        select: { id: true },
      });
      const managerIds = managers.map((m) => m.id);

      let agentIds: string[] = [];
      if (managerIds.length > 0) {
        const agents = await prisma.user.findMany({
          where: {
            organizationId: dbUser.organizationId,
            isActive: true,
            managerId: { in: managerIds },
          },
          select: { id: true },
        });
        agentIds = agents.map((a) => a.id);
      }

      const idSet = new Set<string>();
      idSet.add(dbUser.id); // the director
      managerIds.forEach((id) => idSet.add(id));
      agentIds.forEach((id) => idSet.add(id));

      return Array.from(idSet);
    }

    default: {
      // AGENT, READ_ONLY, etc. → self-only by default
      return [dbUser.id];
    }
  }
}

