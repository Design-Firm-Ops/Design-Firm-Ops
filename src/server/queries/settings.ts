import { prisma } from '@/server/prisma';

// Firm settings and user administration reads.
//
// Every function here takes the firm explicitly and must filter by it. That is
// load-bearing rather than stylistic: these are called from page components,
// which do not go through the tenant client, so the `where` below is the only
// thing keeping one firm's data out of another's screen.
//
// `listUsers` and `listDesigners` accepted a firmId and ignored it, which
// showed every user on the platform — the platform operator included — on
// /app/settings and /app/administration. `queryScoping.test.ts` now fails if
// any query here takes a firmId without using it.

export function getSettings(firmId: string) {
  return prisma.settings.findUnique({ where: { firmId } });
}

export function listUsers(firmId: string) {
  return prisma.user.findMany({
    where: { firmId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export function listDesigners(firmId: string) {
  return prisma.user.findMany({
    where: { firmId, role: 'DESIGNER' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
}

export function listPermissionOverrides(firmId: string) {
  return prisma.userPermissionOverride.findMany({ where: { firmId } });
}
