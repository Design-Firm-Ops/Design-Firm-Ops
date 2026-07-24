import { describe, it, expect } from 'vitest';
import { formatDate, formatLongDate } from '@/lib/format';

describe('formatDate', () => {
  it('formats a date-only string as the day it names', () => {
    // The bug this fixes: `new Date('2026-01-15')` parses as UTC midnight,
    // so toLocaleDateString() renders Jan 14 anywhere west of UTC.
    expect(formatDate('2026-01-15')).toBe('1/15/2026');
    expect(formatDate('2026-12-31')).toBe('12/31/2026');
    expect(formatDate('2026-01-01')).toBe('1/1/2026');
  });

  it('formats a full ISO timestamp in local time', () => {
    // Timestamps carry a real instant, so the local calendar day is correct.
    const iso = new Date(2026, 0, 15, 12, 0, 0).toISOString();
    expect(formatDate(iso)).toBe('1/15/2026');
  });

  it('accepts a Date', () => {
    expect(formatDate(new Date(2026, 6, 4))).toBe('7/4/2026');
  });

  it('renders an em dash for missing values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('renders an em dash rather than "Invalid Date"', () => {
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('formatLongDate', () => {
  it('spells the month out, for documents', () => {
    expect(formatLongDate('2026-01-15')).toBe('Jan 15, 2026');
  });

  it('shares the date-only handling', () => {
    expect(formatLongDate('2026-12-31')).toBe('Dec 31, 2026');
    expect(formatLongDate(null)).toBe('—');
  });
});

describe('formatDate — edge inputs', () => {
  it('rejects an Invalid Date object rather than rendering "Invalid Date"', () => {
    expect(formatDate(new Date('nonsense'))).toBe('—');
    expect(formatLongDate(new Date('nonsense'))).toBe('—');
  });
});
