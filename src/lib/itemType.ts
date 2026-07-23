import { prisma } from '@/lib/prisma';

/**
 * Finds an ItemTypeOption by (category, name) or creates it — the list
 * grows as users type new values, same pattern as ProjectType. A
 * brand-new type gets an auto-generated tagPrefix, made unique across
 * every existing type so two types never share an ambiguous prefix.
 */
export async function findOrCreateItemType(
  category: string | undefined | null,
  name: string | undefined | null
): Promise<string | null> {
  const trimmedCategory = category?.trim();
  const trimmedName = name?.trim();
  if (!trimmedCategory || !trimmedName) return null;

  const existing = await prisma.itemTypeOption.findUnique({
    where: { category_name: { category: trimmedCategory, name: trimmedName } },
  });
  if (existing) return existing.id;

  const existingPrefixes = new Set(
    (await prisma.itemTypeOption.findMany({ select: { tagPrefix: true } })).map((t) => t.tagPrefix)
  );
  const tagPrefix = generateUniquePrefix(trimmedName, existingPrefixes);

  const maxOrder = await prisma.itemTypeOption.aggregate({
    where: { category: trimmedCategory },
    _max: { order: true },
  });

  const created = await prisma.itemTypeOption.create({
    data: { category: trimmedCategory, name: trimmedName, tagPrefix, order: (maxOrder._max.order ?? -1) + 1 },
  });
  return created.id;
}

function generateUniquePrefix(name: string, taken: Set<string>): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '') || 'XX';

  const base = letters.slice(0, 2).padEnd(2, 'X');
  if (!taken.has(base)) return base;

  // Try the first letter paired with each subsequent letter in the name.
  for (let i = 2; i < letters.length; i++) {
    const candidate = letters[0] + letters[i];
    if (!taken.has(candidate)) return candidate;
  }

  // Fall back to numbering the base prefix.
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${base}${Date.now() % 1000}`;
}
