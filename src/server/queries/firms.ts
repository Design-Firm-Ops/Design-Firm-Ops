import type { PlatformDb } from '@/server/platformDb';
import type { FirmStatus } from '@/lib/domain';
import { firmListWhere, latestActivity, type FirmFilters } from '@/lib/firms';

// Firm reads for the /admin console.
//
// Cross-firm by nature, so these take the platform client as an argument
// rather than importing prisma: you cannot call them without having gone
// through `getPlatformDb`, which is where the SUPER_ADMIN check lives. The
// firm-facing query modules take a `firmId` for the same reason — the caller
// has to supply the thing that makes the query legitimate.

/**
 * Only what this module needs, so tests can pass a stub.
 *
 * `project | invoice | item` are the tables that count as "someone did work
 * here" — see `lastActivityByFirm`.
 */
type Db = Pick<PlatformDb, 'firm' | 'project' | 'invoice' | 'item'>;

export interface FirmListRow {
  id: string;
  name: string;
  slug: string;
  status: FirmStatus;
  plan: string | null;
  createdAt: Date;
  userCount: number;
  projectCount: number;
  /** Null when the firm has never been worked in — see `latestActivity`. */
  lastActivityAt: Date | null;
}

/**
 * Every firm the filters match, with the usage figures the console lists.
 *
 * Ordered by name so the ordering is done in SQL and survives pagination.
 * Sorting by last activity would read better but can't be expressed in the
 * query — it's derived across three tables — and sorting it in JS would only
 * work while the whole list fits on one page.
 */
export async function listFirms(db: Db, filters: FirmFilters): Promise<FirmListRow[]> {
  const firms = await db.firm.findMany({
    where: firmListWhere(filters),
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      plan: true,
      createdAt: true,
      // Counted by the database rather than by fetching rows to measure them.
      _count: { select: { users: true, projects: true } },
    },
  });

  if (firms.length === 0) return [];

  const activity = await lastActivityByFirm(
    db,
    firms.map((f) => f.id)
  );

  return firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    slug: firm.slug,
    status: firm.status as FirmStatus,
    plan: firm.plan,
    createdAt: firm.createdAt,
    userCount: firm._count.users,
    projectCount: firm._count.projects,
    lastActivityAt: activity.get(firm.id) ?? null,
  }));
}

/**
 * The most recent update per firm, across the work tables.
 *
 * One grouped query per source, scoped to the firms being listed — each has an
 * indexed `firmId`, so this is a handful of index scans rather than a scan of
 * every project on the platform.
 */
async function lastActivityByFirm(db: Db, firmIds: string[]): Promise<Map<string, Date>> {
  const where = { firmId: { in: firmIds } };

  // Written out three times rather than looped: Prisma types `groupBy` per
  // model, so both the delegate and the argument literal have to be concrete
  // at the call site. Sharing the `where` is as far as it factors.
  const [projects, invoices, items] = await Promise.all([
    db.project.groupBy({ by: ['firmId'], where, _max: { updatedAt: true } }),
    db.invoice.groupBy({ by: ['firmId'], where, _max: { updatedAt: true } }),
    db.item.groupBy({ by: ['firmId'], where, _max: { updatedAt: true } }),
  ]);

  const seen = new Map<string, (Date | null | undefined)[]>();
  for (const rows of [projects, invoices, items]) {
    for (const row of rows) {
      const dates = seen.get(row.firmId) ?? [];
      dates.push(row._max?.updatedAt);
      seen.set(row.firmId, dates);
    }
  }

  const latest = new Map<string, Date>();
  for (const [firmId, dates] of seen) {
    const date = latestActivity(dates);
    if (date) latest.set(firmId, date);
  }
  return latest;
}
