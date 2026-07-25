import { prisma } from '@/server/prisma';

// Firm settings and user administration reads.

export function getSettings(firmId: string) {
  return prisma.settings.findUnique({ where: { firmId } });
}

export function listUsers(firmId: string) {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export function listDesigners(firmId: string) {
  return prisma.user.findMany({
    where: { role: 'DESIGNER' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
}

export function listPermissionOverrides(firmId: string) {
  return prisma.userPermissionOverride.findMany({ where: { firmId } });
}
