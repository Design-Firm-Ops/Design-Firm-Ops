import { prisma } from '@/lib/prisma';
import { nextOrder } from '@/lib/order';
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

  const created = await prisma.feeStructureOption.create({
    data: { name: trimmed, scope, order: await nextOrder(prisma.feeStructureOption, { scope }) },
  });
  return created.id;
}
