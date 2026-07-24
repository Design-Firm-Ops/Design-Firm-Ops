import { Prisma } from '@prisma/client';

/**
 * Persists "this JSON column has no value".
 *
 * Prisma distinguishes a JSON column holding the JSON literal `null` from a
 * column that is SQL NULL, and makes you say which via `Prisma.JsonNull` /
 * `Prisma.DbNull`. That's an ORM encoding detail, and it was leaking into
 * route handlers — which had to import the `Prisma` namespace purely to clear
 * a column. Routes now pass a plain `null` and this translates at the edge.
 *
 * `Prisma.JsonNull` (the JSON literal) preserves the previous behaviour.
 */
export function jsonOrNull<T>(value: T | null | undefined): T | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
}
