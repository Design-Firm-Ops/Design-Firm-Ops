import { prisma } from '@/server/prisma';

// TEMPORARY BRIDGE — remove in DES-#2 / DES-#3.
//
// The schema now knows about tenants, but the *session* does not yet: carrying
// `firmId` on the JWT is DES-#2 (SUPER_ADMIN + auth), and enforcing it on every
// query is DES-#3 (isolation). This module exists so the data model can land on
// its own, ahead of both.
//
// Until then the deployment has exactly one firm — the one the backfill
// migration adopted every existing row into — so "the current firm" is
// unambiguous and this resolves it.
//
// Every call site of `currentFirmId()` is a place that MUST become
// session-derived. That's deliberate: `grep -rn currentFirmId src/` is the
// to-do list for DES-#3, and the isolation suite (DES-#9) should fail if any
// of them are still here.

/** Resolved once per process — the firm row doesn't change under a single-tenant deployment. */
let cached: string | null = null;

/**
 * The firm the current request belongs to.
 *
 * @throws if no firm exists — that means the backfill migration hasn't run, and
 * silently inventing a tenant would be far worse than failing loudly.
 */
export async function currentFirmId(): Promise<string> {
  if (cached) return cached;

  const firm = await prisma.firm.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!firm) {
    throw new Error(
      'No Firm row exists — run `npm run prisma:migrate` (the tenancy backfill) and `npm run prisma:seed`.'
    );
  }

  cached = firm.id;
  return cached;
}

/** Test seam: forget the memoized firm. */
export function resetCurrentFirmCache(): void {
  cached = null;
}

/**
 * The firm that owns a project.
 *
 * `Invoice`, `Item`, and `Payment` carry a denormalized `firmId` that must
 * always equal their project's. Deriving it from the parent here — rather than
 * from the ambient `currentFirmId()` — makes that invariant hold by
 * construction: a row can't be created under a firm its project doesn't
 * belong to.
 *
 * @throws if the project doesn't exist.
 */
export async function projectFirmId(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { firmId: true } });
  if (!project) throw new Error(`No project ${projectId}`);
  return project.firmId;
}
