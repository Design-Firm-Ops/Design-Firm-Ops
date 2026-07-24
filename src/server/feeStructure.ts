import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { nextOrder } from '@/server/order';
import type { FeeStructureScope } from '@/lib/domain';

/** Finds a FeeStructureOption by (scope, name) or creates it — the list grows as users type new values. */
export async function findOrCreateFeeStructureOption(
  name: string | undefined | null,
  scope: FeeStructureScope
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const firmId = await currentFirmId();
  const existing = await prisma.feeStructureOption.findUnique({
    where: { firmId_scope_name: { firmId, scope, name: trimmed } },
  });
  if (existing) return existing.id;

  const created = await prisma.feeStructureOption.create({
    data: { name: trimmed, scope, firmId, order: await nextOrder(prisma.feeStructureOption, { firmId, scope }) },
  });
  return created.id;
}
