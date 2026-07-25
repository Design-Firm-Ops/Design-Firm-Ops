import { prisma } from '@/server/prisma';
import { nextOrder } from '@/server/order';

/**
 * Registers a room name as a suggestion for this project if it isn't
 * one already — Item.room stays plain text, this just grows the
 * dropdown so re-typing the same room twice can't drift into a typo.
 * Safe to call on every item save; a no-op once the name exists.
 */
export async function findOrCreateRoom(
  projectId: string,
  name: string | undefined | null,
  firmId: string
): Promise<void> {
  const trimmed = name?.trim();
  if (!trimmed) return;

  const existing = await prisma.projectRoom.findUnique({ where: { projectId_name: { projectId, name: trimmed } } });
  if (existing) return;

  await prisma.projectRoom.create({
    data: { projectId, name: trimmed, firmId, order: await nextOrder(prisma.projectRoom, { projectId }) },
  });
}
