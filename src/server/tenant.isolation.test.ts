import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import {
  canRunIsolationTests,
  isolationDatabaseUrl,
  setupIsolationDatabase,
  teardownIsolationDatabase,
  skipReason,
} from '@/test/isolationDb';
import { seedTwoFirms, type SeededFirm } from '@/test/twoFirmFixture';
import { EXEMPT_MODEL_NAMES } from '@/lib/isolation';

// The tenant-isolation correctness gate (DES-31).
//
// Runs the REAL tenant client against a REAL Postgres holding two firms whose
// data is deliberately identical — same client name, same "LT-1", same invoice
// "2506-001". A test here can only pass by respecting the tenant boundary, not
// because the values happened to differ.
//
// The /admin console issues are gated on this suite. It only deserves that if
// it would actually fail when isolation breaks, so it asserts behaviour
// (what a firm can see and change) rather than generated SQL.

const enabled = canRunIsolationTests();
if (!enabled) console.warn(skipReason());

/** Model names taken from the schema, so a new model joins the matrix automatically. */
function tenantModelsFromSchema(): string[] {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  return [...schema.matchAll(/^model (\w+) \{/gm)]
    .map((m) => m[1])
    .filter((name) => !EXEMPT_MODEL_NAMES.includes(name));
}

/** Prisma's client property for a model name: `ClientContact` -> `clientContact`. */
const delegateOf = (model: string) => model[0].toLowerCase() + model.slice(1);

/** Prisma's delegates, reachable by name — the matrix is driven from the schema. */
type Delegates = Record<string, { findMany: (args?: unknown) => Promise<Record<string, unknown>[]> }>;
const byName = (client: unknown) => client as unknown as Delegates;

describe.skipIf(!enabled)('tenant isolation (integration)', () => {
  let raw: PrismaClient;
  let a: SeededFirm;
  let b: SeededFirm;
  let dbA: PrismaClient;
  let dbB: PrismaClient;

  beforeAll(async () => {
    // The tenant client is built against the isolation database rather than
    // the app's, so `@/server/prisma` is pointed at it before importing.
    process.env.DATABASE_URL = isolationDatabaseUrl()!;
    raw = await setupIsolationDatabase();

    const seeded = await seedTwoFirms(raw);
    a = seeded.a;
    b = seeded.b;

    const { tenantScope } = await import('@/server/tenantDb');
    dbA = tenantScope(a.firmId) as unknown as PrismaClient;
    dbB = tenantScope(b.firmId) as unknown as PrismaClient;
  }, 120_000);

  afterAll(async () => {
    if (raw) await teardownIsolationDatabase(raw);
  });

  // ---------------------------------------------------------------------
  // Per-model matrix — every tenant model, driven from the schema.
  // ---------------------------------------------------------------------

  describe('every tenant model reads only its own firm', () => {
    for (const model of tenantModelsFromSchema()) {
      it(`${model}`, async () => {
        const key = delegateOf(model);
        const rowsA = await byName(dbA)[key].findMany();
        const rowsB = await byName(dbB)[key].findMany();
        const all = await byName(raw)[key].findMany();

        // The fixture seeds both firms, so anything less than "each sees some"
        // means the matrix isn't actually exercising this model.
        expect(rowsA.length, `${model}: firm A sees nothing — fixture gap?`).toBeGreaterThan(0);
        expect(rowsB.length, `${model}: firm B sees nothing — fixture gap?`).toBeGreaterThan(0);

        expect(rowsA.every((r) => r.firmId === a.firmId)).toBe(true);
        expect(rowsB.every((r) => r.firmId === b.firmId)).toBe(true);

        const idsB = new Set(rowsB.map((r) => r.id));
        expect(rowsA.some((r) => idsB.has(r.id)), `${model}: views overlap`).toBe(false);

        // Together they account for everything — neither firm is silently
        // losing rows, which would be isolation "working" for the wrong reason.
        expect(rowsA.length + rowsB.length).toBe(all.length);
      });
    }
  });

  // ---------------------------------------------------------------------
  // Cross-firm reads and writes
  // ---------------------------------------------------------------------

  describe('cross-firm reads', () => {
    it("findUnique on another firm's row returns null", async () => {
      expect(await dbA.project.findUnique({ where: { id: b.projectId } })).toBeNull();
      expect(await dbA.invoice.findUnique({ where: { id: b.invoiceId } })).toBeNull();
      expect(await dbA.document.findUnique({ where: { id: b.documentId } })).toBeNull();
      expect(await dbA.lead.findUnique({ where: { id: b.leadId } })).toBeNull();
    });

    it('own rows are still readable', async () => {
      expect((await dbA.project.findUnique({ where: { id: a.projectId } }))?.id).toBe(a.projectId);
    });

    it('count and aggregate do not cross firms', async () => {
      expect(await dbA.project.count()).toBe(1);
      const agg = await dbA.payment.aggregate({ _sum: { amount: true } });
      // 50 from firm A only — 100 would mean both firms were summed.
      expect(Number(agg._sum.amount)).toBe(50);
    });

    it('a relation filter cannot be used to reach across firms', async () => {
      const items = await dbA.item.findMany({ where: { project: { firmId: b.firmId } } });
      expect(items).toHaveLength(0);
    });
  });

  describe('cross-firm writes', () => {
    it("update of another firm's row is refused and leaves it intact", async () => {
      await expect(
        dbA.project.update({ where: { id: b.projectId }, data: { name: 'HACKED' } })
      ).rejects.toThrow();

      const victim = await raw.project.findUnique({ where: { id: b.projectId } });
      expect(victim?.name).not.toBe('HACKED');
    });

    it("delete of another firm's row is refused and it survives", async () => {
      await expect(dbA.invoice.delete({ where: { id: b.invoiceId } })).rejects.toThrow();
      expect(await raw.invoice.findUnique({ where: { id: b.invoiceId } })).not.toBeNull();
    });

    it('updateMany cannot reach across firms', async () => {
      const result = await dbA.project.updateMany({ data: { leadDesignerName: 'Swept' } });
      expect(result.count).toBe(1);

      const other = await raw.project.findUnique({ where: { id: b.projectId } });
      expect(other?.leadDesignerName).not.toBe('Swept');
    });

    it('deleteMany cannot reach across firms', async () => {
      const before = await raw.projectRoom.count();
      const result = await dbA.projectRoom.deleteMany({});
      expect(result.count).toBe(1);
      expect(await raw.projectRoom.count()).toBe(before - 1);
      // Firm B's room survived.
      expect(await dbB.projectRoom.count()).toBe(1);
    });
  });

  describe('creates are stamped with the caller’s firm', () => {
    it('stamps firmId automatically', async () => {
      const created = await dbA.client.create({ data: { name: 'Stamped' } as never });
      expect(created.firmId).toBe(a.firmId);
    });

    // The context is authoritative — a caller cannot write into another tenant
    // by passing its id.
    it("ignores a caller-supplied firmId pointing at another firm", async () => {
      const created = await dbA.client.create({ data: { name: 'Forced', firmId: b.firmId } as never });
      expect(created.firmId).toBe(a.firmId);
      expect(await dbB.client.findUnique({ where: { id: created.id } })).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Nested writes — the extension's known blind spot
  // ---------------------------------------------------------------------

  describe('nested writes', () => {
    // A nested create is a single query, so the extension never sees the inner
    // rows. The app passes firmId explicitly at those sites; this proves the
    // result actually lands in the right firm.
    it('a nested create lands in the parent’s firm', async () => {
      const client = await dbA.client.create({
        data: {
          name: 'With Contacts',
          contacts: { create: [{ name: 'Nested Contact', order: 0, firmId: a.firmId }] },
        } as never,
        include: { contacts: true },
      });

      expect(client.contacts).toHaveLength(1);
      expect(client.contacts[0].firmId).toBe(a.firmId);
      expect(await dbB.clientContact.findUnique({ where: { id: client.contacts[0].id } })).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Per-firm uniques (named explicitly in the issue)
  // ---------------------------------------------------------------------

  describe('per-firm uniques', () => {
    it('both firms already hold the same item tag, invoice number and offering', async () => {
      const [itemA, itemB] = [await dbA.item.findFirst(), await dbB.item.findFirst()];
      expect(itemA?.tag).toBe('LT-1');
      expect(itemB?.tag).toBe('LT-1');

      const [invA, invB] = [await dbA.invoice.findFirst(), await dbB.invoice.findFirst()];
      expect(invA?.invoiceNumber).toBe('2506-001');
      expect(invB?.invoiceNumber).toBe('2506-001');

      const [offA, offB] = [await dbA.offering.findFirst(), await dbB.offering.findFirst()];
      expect(offA?.name).toBe('Lighting');
      expect(offB?.name).toBe('Lighting');
    });

    it('a firm still cannot duplicate a name within itself', async () => {
      await expect(
        dbA.offering.create({ data: { name: 'Lighting', order: 1 } as never })
      ).rejects.toThrow();
    });

    it('the same project type name is fine across firms', async () => {
      const a2 = await dbA.projectType.findFirst();
      const b2 = await dbB.projectType.findFirst();
      expect(a2?.name).toBe(b2?.name);
      expect(a2?.id).not.toBe(b2?.id);
    });
  });

  // ---------------------------------------------------------------------
  // Fails closed
  // ---------------------------------------------------------------------

  describe('fails closed', () => {
    it('refuses a session with no firm, and a super-admin', async () => {
      const { getTenantDb } = await import('@/server/tenantDb');
      expect(() => getTenantDb(null)).toThrow(/no firm/i);
      expect(() =>
        getTenantDb({ user: { id: 'u', role: 'SUPER_ADMIN', firmId: null } } as never)
      ).toThrow(/platform operator/i);
    });
  });

  // ---------------------------------------------------------------------
  // The deliberate cross-firm path (DES-26)
  // ---------------------------------------------------------------------

  // The /admin console is the first thing that *means* to read across firms.
  // Asserting only that tenants can't cross would leave the other half
  // untested: a change that broke cross-firm reads entirely would keep this
  // suite green while the console silently showed one firm.
  describe('the platform client', () => {
    const operator = { user: { id: 'op', role: 'SUPER_ADMIN', firmId: null } } as never;

    it('sees every firm, where a tenant client sees one', async () => {
      const { getPlatformDb } = await import('@/server/platformDb');
      const platform = getPlatformDb(operator);

      const firmIds = (await platform.firm.findMany({ select: { id: true } })).map((f) => f.id);
      expect(firmIds).toHaveLength(2);
      expect(firmIds).toEqual(expect.arrayContaining([a.firmId, b.firmId]));

      // The same question, asked three ways: across firms, and from inside each.
      const all = await platform.project.findMany();
      expect(all).toHaveLength(2);
      expect(await dbA.project.count()).toBe(1);
      expect(await dbB.project.count()).toBe(1);
    });

    it('is refused to everyone who is not the platform operator', async () => {
      const { getPlatformDb } = await import('@/server/platformDb');

      expect(() => getPlatformDb(null)).toThrow(/platform operator/i);
      expect(() =>
        getPlatformDb({ user: { id: 'u', role: 'ADMIN', firmId: a.firmId } } as never)
      ).toThrow(/platform operator/i);
      expect(() =>
        getPlatformDb({ user: { id: 'u', role: 'DESIGNER', firmId: a.firmId } } as never)
      ).toThrow(/platform operator/i);
    });

    // What the console actually renders: counts and activity per firm, each
    // attributed to the right firm rather than summed across the platform.
    it('reports per-firm counts, not platform totals', async () => {
      const { getPlatformDb } = await import('@/server/platformDb');
      const { listFirms } = await import('@/server/queries/firms');
      const { NO_FIRM_FILTERS } = await import('@/lib/firms');

      const rows = await listFirms(getPlatformDb(operator), NO_FIRM_FILTERS);
      expect(rows).toHaveLength(2);

      for (const row of rows) {
        expect(row.userCount, `${row.slug} user count`).toBe(1);
        expect(row.projectCount, `${row.slug} project count`).toBe(1);
        expect(row.lastActivityAt).toBeInstanceOf(Date);
      }
    });

    it('filters by name and status in the database', async () => {
      const { getPlatformDb } = await import('@/server/platformDb');
      const { listFirms } = await import('@/server/queries/firms');
      const platform = getPlatformDb(operator);

      // The fixture names are "Firm A Interiors" and "Firm B Design".
      const searched = await listFirms(platform, { search: 'interiors', status: 'ALL' });
      expect(searched.map((f) => f.slug)).toEqual(['firm-a']);

      // Case-insensitively — an operator types what they remember.
      expect(await listFirms(platform, { search: 'INTERIORS', status: 'ALL' })).toHaveLength(1);

      // Both fixtures are ACTIVE, so this is the filter proving it narrows.
      expect(await listFirms(platform, { search: '', status: 'ACTIVE' })).toHaveLength(2);
      expect(await listFirms(platform, { search: '', status: 'SUSPENDED' })).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------
  // Firm lifecycle (DES-27) — the first console action that *writes*
  // ---------------------------------------------------------------------

  describe('suspending a firm', () => {
    const operator = { user: { id: 'op', email: 'op@x.test', role: 'SUPER_ADMIN', firmId: null } } as never;

    it('affects that firm only, and leaves the other able to work', async () => {
      const { getPlatformDb } = await import('@/server/platformDb');
      const { firmDenialFor } = await import('@/server/firmGate');
      const platform = getPlatformDb(operator);

      await platform.firm.update({ where: { id: a.firmId }, data: { status: 'SUSPENDED' } });

      const sessionFor = (firmId: string) => ({ user: { id: 'u', role: 'ADMIN', firmId } }) as never;
      expect(await firmDenialFor(sessionFor(a.firmId))).toBe('FIRM_SUSPENDED');
      expect(await firmDenialFor(sessionFor(b.firmId)), 'firm B was caught in the blast').toBeNull();

      // And the suspended firm's data is untouched — suspension is a status
      // flip, never a deletion.
      expect(await dbA.project.count()).toBe(1);

      await platform.firm.update({ where: { id: a.firmId }, data: { status: 'ACTIVE' } });
      expect(await firmDenialFor(sessionFor(a.firmId))).toBeNull();
    });

    it('records who did it, against the right firm', async () => {
      const { getPlatformDb } = await import('@/server/platformDb');
      const { recordFirmStatusChange } = await import('@/server/audit');
      const platform = getPlatformDb(operator);

      await recordFirmStatusChange(platform, operator, {
        firmId: b.firmId,
        from: 'ACTIVE',
        to: 'SUSPENDED',
      });

      const entries = await platform.auditLog.findMany({ where: { firmId: b.firmId } });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ actorId: 'op', action: 'firm.suspend' });
      expect(entries[0].detail).toEqual({ from: 'ACTIVE', to: 'SUSPENDED' });

      // The record belongs to firm B alone.
      expect(await platform.auditLog.count({ where: { firmId: a.firmId } })).toBe(0);
    });

    // The audit trail is platform-only: a firm must not be able to read what
    // was done to it, and the tenant client refuses rather than filtering.
    it('is not readable through a tenant client at all', async () => {
      await expect(
        (dbA as unknown as { auditLog: { findMany: () => Promise<unknown> } }).auditLog.findMany()
      ).rejects.toThrow(/platform-only/i);
    });
  });

  // ---------------------------------------------------------------------
  // Sign-up provisioning (DES-28) — the acceptance criterion
  // ---------------------------------------------------------------------

  // "A newly provisioned firm can log in and reaches a working, isolated /app
  // with sane defaults" is a claim about isolation, so it's answered here
  // rather than asserted in a unit test with a stub.
  describe('a firm created by sign-up', () => {
    it('gets a complete, isolated set of defaults', async () => {
      const { provisionFirm } = await import('@/server/provisionFirm');
      const {
        DEFAULT_OFFERINGS,
        DEFAULT_FEE_STRUCTURES,
        DEFAULT_ITEM_TYPES,
        DEFAULT_PIPELINE_STAGES,
      } = await import('@/server/firmDefaults');
      const { tenantScope } = await import('@/server/tenantDb');

      const { firmId, userId } = await provisionFirm(
        {
          firmName: 'Newly Signed Up',
          adminName: 'New Owner',
          email: 'owner@newly.test',
          password: 'correct horse battery',
          plan: 'YEARLY',
        },
        raw
      );

      const db = tenantScope(firmId) as unknown as PrismaClient;

      // Everything the app needs to be usable, seen through the new firm's
      // own client — so this also proves the rows were stamped correctly.
      expect(await db.offering.count()).toBe(DEFAULT_OFFERINGS.length);
      expect(await db.feeStructureOption.count()).toBe(DEFAULT_FEE_STRUCTURES.length);
      expect(await db.itemTypeOption.count()).toBe(DEFAULT_ITEM_TYPES.length);
      expect(await db.pipelineStage.count()).toBe(DEFAULT_PIPELINE_STAGES.length);
      expect(await db.leadBoard.count()).toBe(1);

      // resolvePermissions reads this on every request; without it the app
      // breaks on the first page load.
      expect(await db.settings.findFirst()).not.toBeNull();

      // The signer runs the firm, and starts on a trial that DES-27 lets in.
      const user = await raw.user.findUnique({ where: { id: userId } });
      expect(user).toMatchObject({ role: 'ADMIN', firmId });
      expect((await raw.firm.findUnique({ where: { id: firmId } }))?.status).toBe('TRIAL');

      // Isolated from the firms that already existed, in both directions.
      expect(await db.project.count(), 'sees another firm’s projects').toBe(0);
      expect(await db.client.count()).toBe(0);

      // And firm A still sees only its own. Note this can't be written as
      // `dbA.offering.findFirst({ where: { firmId } })` — the extension
      // overwrites a caller-supplied firmId, which is the point of it.
      const seenByA = await dbA.offering.findMany();
      expect(seenByA.every((o) => o.firmId === a.firmId)).toBe(true);

      const { firmDenialFor } = await import('@/server/firmGate');
      expect(await firmDenialFor({ user: { id: userId, role: 'ADMIN', firmId } } as never)).toBeNull();
    });

    it('gives a second firm of the same name its own handle and its own data', async () => {
      const { provisionFirm } = await import('@/server/provisionFirm');

      const first = await provisionFirm(
        { firmName: 'Same Name Studio', adminName: 'A', email: 'a@same.test', password: 'correct horse' },
        raw
      );
      const second = await provisionFirm(
        { firmName: 'Same Name Studio', adminName: 'B', email: 'b@same.test', password: 'correct horse' },
        raw
      );

      expect(first.slug).toBe('same-name-studio');
      expect(second.slug).toBe('same-name-studio-2');
      expect(second.firmId).not.toBe(first.firmId);

      // Both hold an offering called "Furniture" — the per-firm uniques again,
      // now exercised by provisioning rather than by a fixture.
      const { tenantScope } = await import('@/server/tenantDb');
      for (const { firmId } of [first, second]) {
        const db = tenantScope(firmId) as unknown as PrismaClient;
        expect((await db.offering.findFirst({ where: { name: 'Furniture' } }))?.firmId).toBe(firmId);
      }
    });

    it('refuses a second sign-up with the same email', async () => {
      const { provisionFirm, EmailTakenError } = await import('@/server/provisionFirm');
      const input = {
        firmName: 'Duplicate Email Co',
        adminName: 'C',
        email: 'taken@example.test',
        password: 'correct horse',
      };

      await provisionFirm(input, raw);
      await expect(provisionFirm({ ...input, firmName: 'Another' }, raw)).rejects.toBeInstanceOf(
        EmailTakenError
      );

      // And left nothing half-built behind.
      expect(await raw.firm.count({ where: { name: 'Another' } })).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // resolvePermissions reads the right firm's Settings
  // ---------------------------------------------------------------------

  describe('resolvePermissions is per firm', () => {
    it('resolves differently for two firms with different settings', async () => {
      const { resolvePermissions } = await import('@/server/permissions');
      const designer = (firmId: string) =>
        ({ user: { id: 'u', role: 'DESIGNER', firmId } }) as never;

      // The fixture gives firm A designerCanViewFinancials, firm B not.
      expect((await resolvePermissions(designer(a.firmId))).financials).toBe(true);
      expect((await resolvePermissions(designer(b.firmId))).financials).toBe(false);
    });
  });
});
