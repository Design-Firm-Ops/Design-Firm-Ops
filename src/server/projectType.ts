import { prisma } from '@/server/prisma';

/** Finds a ProjectType by name or creates it — the list grows as users type new values. */
export async function findOrCreateProjectType(
  name: string | undefined | null,
  firmId: string
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await prisma.projectType.findUnique({ where: { firmId_name: { firmId, name: trimmed } } });
  if (existing) return existing.id;

  const created = await prisma.projectType.create({ data: { name: trimmed, firmId } });
  return created.id;
}
