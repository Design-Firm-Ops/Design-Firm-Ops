import { prisma } from '@/server/prisma';

/**
 * Auto-generates the next tag for a given item type within one project
 * — "TA-1", "TA-2", ... for the first, second Table on that project,
 * "SC-1" for the first Sconce, etc. Numbering is scoped per project
 * (like invoice numbers), not global across the firm.
 */
export async function nextItemTag(projectId: string, itemTypeId: string): Promise<string | null> {
  const itemType = await prisma.itemTypeOption.findUnique({ where: { id: itemTypeId } });
  if (!itemType) return null;

  const count = await prisma.item.count({ where: { projectId, itemTypeId } });
  return `${itemType.tagPrefix}-${count + 1}`;
}
