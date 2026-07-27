import { describe, it, expect, vi } from 'vitest';
import { listFirms } from '@/server/queries/firms';
import { NO_FIRM_FILTERS } from '@/lib/firms';

// A stubbed client, so these pin the *shape* of the queries — that filtering
// happens in SQL, and that activity is gathered per firm rather than per row.

function stubDb(overrides: Record<string, unknown> = {}) {
  const firm = {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 'f1',
        name: 'Firm A Interiors',
        slug: 'firm-a',
        status: 'ACTIVE',
        plan: 'PRO',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        _count: { users: 3, projects: 2 },
      },
    ]),
  };
  const groupBy = (rows: unknown[]) => ({ groupBy: vi.fn().mockResolvedValue(rows) });

  return {
    firm,
    project: groupBy([{ firmId: 'f1', _max: { updatedAt: new Date('2026-03-01T00:00:00Z') } }]),
    invoice: groupBy([{ firmId: 'f1', _max: { updatedAt: new Date('2026-06-01T00:00:00Z') } }]),
    item: groupBy([{ firmId: 'f1', _max: { updatedAt: new Date('2026-02-01T00:00:00Z') } }]),
    ...overrides,
  } as never;
}

describe('listFirms', () => {
  it('returns a row per firm with its counts', async () => {
    const rows = await listFirms(stubDb(), NO_FIRM_FILTERS);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'f1',
      name: 'Firm A Interiors',
      status: 'ACTIVE',
      plan: 'PRO',
      userCount: 3,
      projectCount: 2,
    });
  });

  it('reports the newest activity across projects, invoices and items', async () => {
    const rows = await listFirms(stubDb(), NO_FIRM_FILTERS);
    // The invoice is the most recent of the three.
    expect(rows[0].lastActivityAt).toEqual(new Date('2026-06-01T00:00:00Z'));
  });

  it('reports no activity for a firm that has never been worked in', async () => {
    const db = stubDb({
      project: { groupBy: vi.fn().mockResolvedValue([]) },
      invoice: { groupBy: vi.fn().mockResolvedValue([]) },
      item: { groupBy: vi.fn().mockResolvedValue([]) },
    });

    const rows = await listFirms(db, NO_FIRM_FILTERS);
    expect(rows[0].lastActivityAt).toBeNull();
  });

  // The filter must reach the database. Filtering in JS would pass a naive
  // test and quietly stop scaling.
  it('pushes the filters into SQL', async () => {
    const db = stubDb();
    await listFirms(db, { search: 'west', status: 'SUSPENDED' });

    expect((db as never as { firm: { findMany: ReturnType<typeof vi.fn> } }).firm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'SUSPENDED', name: { contains: 'west', mode: 'insensitive' } },
      })
    );
  });

  // Activity is only asked about for the firms actually being shown, so
  // filtering to one firm doesn't scan every project in the platform.
  it('gathers activity only for the firms it is listing', async () => {
    const db = stubDb();
    await listFirms(db, NO_FIRM_FILTERS);

    const project = (db as never as { project: { groupBy: ReturnType<typeof vi.fn> } }).project;
    expect(project.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['firmId'],
        where: { firmId: { in: ['f1'] } },
        _max: { updatedAt: true },
      })
    );
  });

  it('does not query for activity at all when no firm matched', async () => {
    const db = stubDb({ firm: { findMany: vi.fn().mockResolvedValue([]) } });
    const rows = await listFirms(db, { search: 'nothing', status: 'ALL' });

    expect(rows).toEqual([]);
    expect((db as never as { project: { groupBy: ReturnType<typeof vi.fn> } }).project.groupBy).not.toHaveBeenCalled();
  });
});
