import { prisma } from '@/server/prisma';

// Firm settings and user administration reads.

export function getSettings() {
  return prisma.settings.findUnique({ where: { id: 1 } });
}

export function listUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export function listDesigners() {
  return prisma.user.findMany({
    where: { role: 'DESIGNER' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
}

export function listPermissionOverrides() {
  return prisma.userPermissionOverride.findMany();
}
