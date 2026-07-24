import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';

/** Finds a ProjectType by name or creates it — the list grows as users type new values. */
export async function findOrCreateProjectType(name: string | undefined | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const firmId = await currentFirmId();
  const existing = await prisma.projectType.findUnique({ where: { firmId_name: { firmId, name: trimmed } } });
  if (existing) return existing.id;

  const created = await prisma.projectType.create({ data: { name: trimmed, firmId } });
  return created.id;
}
