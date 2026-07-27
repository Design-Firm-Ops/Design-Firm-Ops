import { isFirmStatus, type FirmStatus } from '@/lib/domain';

// The firms list, as rules rather than as code inside a page.
//
// Pure on purpose: parsing a query string, building a `where`, and deciding
// what "last activity" means are all decisions, and decisions belong somewhere
// they can be tested without a database. The page and the query module read
// them from here.

export interface FirmFilters {
  /** Trimmed; empty string means "no search", never a search for "". */
  search: string;
  status: FirmStatus | 'ALL';
}

/** Everything, unfiltered — the console's default view. */
export const NO_FIRM_FILTERS: FirmFilters = { search: '', status: 'ALL' };

/**
 * Reads the filters off a query string.
 *
 * Both values arrive as whatever someone typed into the URL, so an
 * unrecognized status widens to ALL rather than narrowing to nothing: the bad
 * failure mode for a console filter is silently hiding a firm the operator
 * went looking for.
 */
export function parseFirmFilters(params: { q?: string; status?: string }): FirmFilters {
  return {
    search: params.q?.trim() ?? '',
    status: isFirmStatus(params.status) ? params.status : 'ALL',
  };
}

/**
 * The Prisma `where` for a filtered firms list.
 *
 * Structurally typed rather than importing Prisma's generated input type —
 * `src/lib` stays free of ORM imports (see `src/lib/domain.ts`), and this
 * assigns cleanly to `Prisma.FirmWhereInput` at the persistence edge.
 */
export interface FirmListWhere {
  status?: FirmStatus;
  name?: { contains: string; mode: 'insensitive' };
}

export function firmListWhere(filters: FirmFilters): FirmListWhere {
  const where: FirmListWhere = {};

  if (filters.status !== 'ALL') where.status = filters.status;

  // Case-insensitive and in SQL. Filtering in JS after the fact would work
  // today and quietly stop scaling with the customer base.
  if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };

  return where;
}

/**
 * When a firm was last worked in.
 *
 * The most recent update across the tables that represent real work, rather
 * than `Firm.updatedAt` — an operator asking "is this firm active?" means
 * "is anyone using it?", not "has the firm record been edited?".
 *
 * Null when there is nothing at all: a firm that has never been worked in has
 * no last-activity date, which is a real answer and renders as such.
 */
export function latestActivity(dates: readonly (Date | null | undefined)[]): Date | null {
  const known = dates.filter((d): d is Date => d instanceof Date);
  if (known.length === 0) return null;

  return known.reduce((latest, d) => (d > latest ? d : latest));
}

/** Where the firms list lives, and how its filters appear in the URL. */
export const FIRMS_PATH = '/admin/firms';

/**
 * The console URL for a set of filters.
 *
 * Shared by the page and the filter control so the query-string shape has one
 * definition; empty filters are omitted, which keeps the default view at a
 * bare `/admin/firms` and makes `parseFirmFilters` the exact inverse.
 */
export function firmsHref(filters: FirmFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.status !== 'ALL') params.set('status', filters.status);

  const query = params.toString();
  return query ? `${FIRMS_PATH}?${query}` : FIRMS_PATH;
}
