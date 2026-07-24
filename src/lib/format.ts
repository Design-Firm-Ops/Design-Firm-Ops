// Date rendering, alongside `money.ts` for amounts. Both answer "how does
// this value appear to a user", so both live in one place.

const MISSING = '—';

/**
 * Parses a value that may be a `Date`, a full ISO timestamp, or a date-only
 * string ("2026-01-15").
 *
 * Date-only strings are the subtle one: `new Date('2026-01-15')` is defined
 * to parse as UTC midnight, so rendering it in any timezone west of UTC
 * shows the *previous* day. Prisma `@db.Date` columns (project start dates,
 * payment dates, invoice due dates) serialize to exactly that shape, so this
 * pins them to local midnight instead.
 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Short form for tables and detail rows — "1/15/2026". */
export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-US') : MISSING;
}

/** Long form for documents the client sees (invoice PDFs, emails) — "Jan 15, 2026". */
export function formatLongDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : MISSING;
}
