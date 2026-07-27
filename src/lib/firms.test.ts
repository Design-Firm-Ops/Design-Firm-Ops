import { describe, it, expect } from 'vitest';
import { parseFirmFilters, firmListWhere, latestActivity, firmsHref, NO_FIRM_FILTERS } from './firms';

describe('parseFirmFilters', () => {
  it('defaults to every firm, unfiltered', () => {
    expect(parseFirmFilters({})).toEqual({ search: '', status: 'ALL' });
    expect(parseFirmFilters({})).toEqual(NO_FIRM_FILTERS);
  });

  it('trims the search term', () => {
    expect(parseFirmFilters({ q: '  westland  ' }).search).toBe('westland');
  });

  it('treats a whitespace-only search as no search', () => {
    expect(parseFirmFilters({ q: '   ' }).search).toBe('');
  });

  it('accepts each real status', () => {
    for (const status of ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELED']) {
      expect(parseFirmFilters({ status }).status).toBe(status);
    }
  });

  // The status arrives from a query string, so it is whatever someone typed.
  // Falling back to ALL shows more than asked rather than less — the failure
  // mode of a console filter is hiding a firm the operator went looking for.
  it('falls back to ALL for an unrecognized status', () => {
    expect(parseFirmFilters({ status: 'DELETED' }).status).toBe('ALL');
    expect(parseFirmFilters({ status: 'active' }).status).toBe('ALL');
    expect(parseFirmFilters({ status: '' }).status).toBe('ALL');
  });
});

describe('firmListWhere', () => {
  it('is empty when nothing is filtered', () => {
    expect(firmListWhere(NO_FIRM_FILTERS)).toEqual({});
  });

  it('filters by status', () => {
    expect(firmListWhere({ search: '', status: 'SUSPENDED' })).toEqual({ status: 'SUSPENDED' });
  });

  // Case-insensitively, and in SQL — an operator typing "west" should find
  // "Westland", and the list must not be filtered in JS after the fact.
  it('searches the name case-insensitively', () => {
    expect(firmListWhere({ search: 'west', status: 'ALL' })).toEqual({
      name: { contains: 'west', mode: 'insensitive' },
    });
  });

  it('combines both', () => {
    expect(firmListWhere({ search: 'west', status: 'ACTIVE' })).toEqual({
      status: 'ACTIVE',
      name: { contains: 'west', mode: 'insensitive' },
    });
  });
});

describe('latestActivity', () => {
  const older = new Date('2026-01-01T00:00:00Z');
  const newer = new Date('2026-06-01T00:00:00Z');

  it('picks the most recent date', () => {
    expect(latestActivity([older, newer])).toEqual(newer);
    expect(latestActivity([newer, older])).toEqual(newer);
  });

  // A firm with no projects, invoices or items has never been worked in. That
  // is a real answer ("nothing yet"), not a missing one, so the column renders
  // a dash rather than an epoch date.
  it('is null when there has been no activity at all', () => {
    expect(latestActivity([])).toBeNull();
    expect(latestActivity([null, null])).toBeNull();
    expect(latestActivity([null, undefined])).toBeNull();
  });

  it('ignores the sources that have nothing', () => {
    expect(latestActivity([null, newer, undefined])).toEqual(newer);
  });

  it('does not mutate its input', () => {
    const dates = [newer, older];
    latestActivity(dates);
    expect(dates).toEqual([newer, older]);
  });
});

describe('firmsHref', () => {
  it('is a bare path when nothing is filtered', () => {
    expect(firmsHref(NO_FIRM_FILTERS)).toBe('/admin/firms');
  });

  it('carries each filter it has', () => {
    expect(firmsHref({ search: '', status: 'ACTIVE' })).toBe('/admin/firms?status=ACTIVE');
    expect(firmsHref({ search: 'west', status: 'ALL' })).toBe('/admin/firms?q=west');
    expect(firmsHref({ search: 'west', status: 'ACTIVE' })).toBe('/admin/firms?q=west&status=ACTIVE');
  });

  it('escapes the search term', () => {
    expect(firmsHref({ search: 'a&b c', status: 'ALL' })).toBe('/admin/firms?q=a%26b+c');
  });

  // Round-tripping is the property that matters: whatever the URL says, the
  // filters parse back to the same thing, so the controls always show the
  // state the list was actually built from.
  it('round-trips through parseFirmFilters', () => {
    for (const filters of [
      NO_FIRM_FILTERS,
      { search: 'west', status: 'SUSPENDED' as const },
      { search: 'a&b c', status: 'ALL' as const },
    ]) {
      const query = Object.fromEntries(new URLSearchParams(firmsHref(filters).split('?')[1] ?? ''));
      expect(parseFirmFilters(query)).toEqual(filters);
    }
  });
});
