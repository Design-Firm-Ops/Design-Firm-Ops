import { prisma } from '@/lib/prisma';
import type { FeeStructureScope } from '@prisma/client';

/** Finds a FeeStructureOption by (scope, name) or creates it — the list grows as users type new values. */
export async function findOrCreateFeeStructureOption(
  name: string | undefined | null,
  scope: FeeStructureScope
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await prisma.feeStructureOption.findUnique({ where: { scope_name: { scope, name: trimmed } } });
  if (existing) return existing.id;

  const maxOrder = await prisma.feeStructureOption.aggregate({ _max: { order: true }, where: { scope } });
  const created = await prisma.feeStructureOption.create({
    data: { name: trimmed, scope, order: (maxOrder._max.order ?? -1) + 1 },
  });
  return created.id;
}
