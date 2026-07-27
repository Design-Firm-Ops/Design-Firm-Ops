import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { provisionFirm, EmailTakenError } from '@/server/provisionFirm';
import { DEFAULT_OFFERINGS, DEFAULT_ITEM_TYPES, DEFAULT_PIPELINE_STAGES } from '@/server/firmDefaults';

// Unit level: the decisions — email collisions, slug retries, and that every
// default is asked for inside one transaction.
//
// That the resulting firm actually *works* is a claim about a real database,
// and it's asserted in the isolation suite against real Postgres instead.

const uniqueViolation = (target: string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [target] },
  });

interface StubOptions {
  existingEmail?: boolean;
  /** Slugs that are already taken — creating a firm with one throws P2002. */
  takenSlugs?: string[];
  failUserWith?: unknown;
}

function stubDb({ existingEmail = false, takenSlugs = [], failUserWith }: StubOptions = {}) {
  const created: Record<string, unknown[]> = {};
  const record = (table: string) => (args: { data: unknown }) => {
    const rows = Array.isArray(args.data) ? args.data : [args.data];
    created[table] = [...(created[table] ?? []), ...rows];
    return Promise.resolve({ id: `${table}-1`, ...(rows[0] as object) });
  };

  const tx = {
    firm: {
      create: vi.fn((args: { data: { slug: string } }) => {
        if (takenSlugs.includes(args.data.slug)) return Promise.reject(uniqueViolation('slug'));
        return record('firm')(args);
      }),
    },
    // `applyFirmDefaults` is idempotent, so it counts before creating; a fresh
    // firm has nothing, hence zero.
    settings: { upsert: vi.fn((args: { create: unknown }) => record('settings')({ data: args.create })) },
    offering: { createMany: vi.fn(record('offering')), count: vi.fn().mockResolvedValue(0) },
    feeStructureOption: {
      createMany: vi.fn(record('feeStructureOption')),
      count: vi.fn().mockResolvedValue(0),
    },
    itemTypeOption: { createMany: vi.fn(record('itemTypeOption')), count: vi.fn().mockResolvedValue(0) },
    leadBoard: { create: vi.fn(record('leadBoard')), findFirst: vi.fn().mockResolvedValue(null) },
    pipelineStage: { createMany: vi.fn(record('pipelineStage')), count: vi.fn().mockResolvedValue(0) },
    user: {
      create: vi.fn((args: { data: unknown }) => {
        if (failUserWith) return Promise.reject(failUserWith);
        return record('user')(args);
      }),
    },
  };

  const db = {
    user: { findUnique: vi.fn().mockResolvedValue(existingEmail ? { id: 'u0' } : null) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => Promise.resolve(fn(tx))),
  };

  return { db: db as never, tx, created, transaction: db.$transaction };
}

const INPUT = {
  firmName: 'Harbor & Pine Design Co.',
  adminName: 'Sam Reyes',
  email: '  SAM@Harbor.TEST ',
  password: 'correct horse battery',
  plan: 'MONTHLY',
};

describe('provisionFirm', () => {
  it('creates the firm on a trial, with a slug from its name', async () => {
    const { db, tx } = stubDb();
    const result = await provisionFirm(INPUT, db);

    expect(tx.firm.create).toHaveBeenCalledWith({
      data: { name: 'Harbor & Pine Design Co.', slug: 'harbor-pine-design-co', status: 'TRIAL', plan: 'MONTHLY' },
    });
    expect(result.slug).toBe('harbor-pine-design-co');
  });

  it('normalizes the email and makes the signer an ADMIN', async () => {
    const { db, tx } = stubDb();
    await provisionFirm(INPUT, db);

    const data = tx.user.create.mock.calls[0][0].data as { email: string; role: string; passwordHash: string };
    expect(data.email).toBe('sam@harbor.test');
    expect(data.role).toBe('ADMIN');
    // Never the plaintext.
    expect(data.passwordHash).not.toBe(INPUT.password);
    expect(data.passwordHash.startsWith('$2')).toBe(true);
  });

  // The acceptance criterion is "a working /app with sane defaults" — this is
  // the list that makes it true.
  it('gives the firm every default', async () => {
    const { db, created, tx } = stubDb();
    await provisionFirm(INPUT, db);

    expect(created.offering).toHaveLength(DEFAULT_OFFERINGS.length);
    expect(created.itemTypeOption).toHaveLength(DEFAULT_ITEM_TYPES.length);
    expect(created.pipelineStage).toHaveLength(DEFAULT_PIPELINE_STAGES.length);
    expect(tx.settings.upsert).toHaveBeenCalled();
    expect(tx.leadBoard.create).toHaveBeenCalled();
  });

  it('stamps every default with the new firm', async () => {
    const { db, created } = stubDb();
    await provisionFirm(INPUT, db);

    const rows = Object.entries(created).filter(([table]) => table !== 'firm');
    for (const [table, items] of rows) {
      for (const row of items) {
        expect((row as { firmId?: string }).firmId, `${table} row is not stamped`).toBe('firm-1');
      }
    }
  });

  // Half a firm is worse than none — a Firm with no Settings breaks
  // resolvePermissions on every request.
  it('does all of it inside one transaction', async () => {
    const { db, transaction } = stubDb();
    await provisionFirm(INPUT, db);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses an email that is already registered', async () => {
    const { db, transaction } = stubDb({ existingEmail: true });

    await expect(provisionFirm(INPUT, db)).rejects.toBeInstanceOf(EmailTakenError);
    // And doesn't half-create a firm on the way to finding out.
    expect(transaction).not.toHaveBeenCalled();
  });

  // The check above races: another sign-up can take the address in between.
  // The unique index is what actually prevents it, and that must surface as
  // the same error rather than a 500.
  it('reports a race on the email as the same failure', async () => {
    const { db } = stubDb({ failUserWith: uniqueViolation('email') });
    await expect(provisionFirm(INPUT, db)).rejects.toBeInstanceOf(EmailTakenError);
  });

  it('picks another handle when the slug is taken', async () => {
    const { db } = stubDb({ takenSlugs: ['harbor-pine-design-co'] });
    const result = await provisionFirm(INPUT, db);
    expect(result.slug).toBe('harbor-pine-design-co-2');
  });

  it('keeps trying past several collisions', async () => {
    const { db } = stubDb({
      takenSlugs: ['harbor-pine-design-co', 'harbor-pine-design-co-2', 'harbor-pine-design-co-3'],
    });
    expect((await provisionFirm(INPUT, db)).slug).toBe('harbor-pine-design-co-4');
  });

  // A name that slugs to nothing must still produce an addressable firm.
  it('handles a name with nothing sluggable in it', async () => {
    const { db } = stubDb();
    const result = await provisionFirm({ ...INPUT, firmName: '!!!' }, db);
    expect(result.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('lets an unexpected database error through rather than retrying forever', async () => {
    const { db } = stubDb({ failUserWith: new Error('connection reset') });
    await expect(provisionFirm(INPUT, db)).rejects.toThrow('connection reset');
  });
});
