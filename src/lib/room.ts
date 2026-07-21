import { prisma } from '@/lib/prisma';

/**
 * Registers a room name as a suggestion for this project if it isn't
 * one already — Item.room stays plain text, this just grows the
 * dropdown so re-typing the same room twice can't drift into a typo.
 * Safe to call on every item save; a no-op once the name exists.
 */
export async function findOrCreateRoom(projectId: string, name: string | undefined | null): Promise<void> {
  const trimmed = name?.trim();
  if (!trimmed) return;

  const existing = await prisma.projectRoom.findUnique({ where: { projectId_name: { projectId, name: trimmed } } });
  if (existing) return;

  const maxOrder = await prisma.projectRoom.aggregate({ where: { projectId }, _max: { order: true } });
  await prisma.projectRoom.create({ data: { projectId, name: trimmed, order: (maxOrder._max.order ?? -1) + 1 } });
}
