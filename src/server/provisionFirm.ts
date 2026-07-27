import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/prisma';
import { slugify, nextSlugCandidate } from '@/lib/slug';
import {
  DEFAULT_OFFERINGS,
  DEFAULT_FEE_STRUCTURES,
  DEFAULT_ITEM_TYPES,
  DEFAULT_LEAD_BOARD,
  DEFAULT_PIPELINE_STAGES,
} from '@/server/firmDefaults';

// Creating a tenant.
//
// The one place a Firm comes into existence, and the single source of truth
// for what a new firm starts with — `prisma/seed.ts` calls it too, so the demo
// tenant and a real sign-up cannot drift apart.
//
// It is also the door `/api/signup` goes through. That route is the app's only
// unauthenticated write, and it has no tenant to scope to because it is the
// thing that makes one; the guarantee that replaces scoping is right here:
// everything created is stamped with the firm just created, in one transaction.

/** How many slug candidates to try before giving up. Collisions need a lot of same-named firms. */
const MAX_SLUG_ATTEMPTS = 25;

const BCRYPT_ROUNDS = 10;

export interface ProvisionFirmInput {
  firmName: string;
  adminName: string;
  email: string;
  password: string;
  /** Free-form tier; billing is mocked for now (DES-28). */
  plan?: string | null;
}

export interface ProvisionedFirm {
  firmId: string;
  userId: string;
  slug: string;
}

/** Thrown when the email is already registered — the caller turns it into a 409. */
export class EmailTakenError extends Error {
  constructor() {
    super('That email address is already registered.');
    this.name = 'EmailTakenError';
  }
}

type Db = typeof prisma;

/** The transaction-or-client shape `applyFirmDefaults` needs. */
type DefaultsClient = Parameters<Parameters<Db['$transaction']>[0]>[0];

/**
 * Gives a firm the baseline lookups it needs to be usable.
 *
 * Idempotent, and separate from `provisionFirm` for a reason: the demo tenant
 * in `prisma/seed.ts` was created by a migration rather than by sign-up, so it
 * can't be provisioned — but it must still get its defaults from the *same*
 * definition, or the two drift. Each group is guarded by a count rather than
 * an upsert, so re-running never duplicates and never overwrites a firm's own
 * edits to these lists.
 */
export async function applyFirmDefaults(
  db: DefaultsClient,
  firmId: string,
  firmName: string
): Promise<void> {
  // Present but otherwise empty: `resolvePermissions` reads this row on every
  // request, and the rest is the firm's to fill in.
  await db.settings.upsert({
    where: { firmId },
    create: { firmId, companyName: firmName },
    update: {},
  });

  if ((await db.offering.count({ where: { firmId } })) === 0) {
    await db.offering.createMany({
      data: DEFAULT_OFFERINGS.map((name, order) => ({ firmId, name, order })),
    });
  }

  if ((await db.feeStructureOption.count({ where: { firmId } })) === 0) {
    await db.feeStructureOption.createMany({
      data: DEFAULT_FEE_STRUCTURES.map((fee, order) => ({ firmId, ...fee, order })),
    });
  }

  if ((await db.itemTypeOption.count({ where: { firmId } })) === 0) {
    await db.itemTypeOption.createMany({
      data: DEFAULT_ITEM_TYPES.map((type, order) => ({ firmId, ...type, order })),
    });
  }

  const board =
    (await db.leadBoard.findFirst({ where: { firmId }, orderBy: { order: 'asc' } })) ??
    (await db.leadBoard.create({ data: { firmId, name: DEFAULT_LEAD_BOARD, order: 0 } }));

  if ((await db.pipelineStage.count({ where: { boardId: board.id } })) === 0) {
    await db.pipelineStage.createMany({
      data: DEFAULT_PIPELINE_STAGES.map((name, order) => ({ firmId, boardId: board.id, name, order })),
    });
  }
}

function isUniqueViolation(error: unknown, target: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;

  const fields = error.meta?.target;
  return Array.isArray(fields) ? fields.includes(target) : String(fields ?? '').includes(target);
}

/**
 * Creates a firm, its baseline lookups, and its first ADMIN user.
 *
 * All in one transaction, because half a firm is worse than none: a Firm with
 * no Settings row breaks `resolvePermissions` on every request, and a User with
 * no Firm is an account nobody can clean up from the console.
 *
 * The slug is settled by retrying on the unique violation rather than checking
 * availability first — between a check and an insert another sign-up can take
 * the name, and only the database can decide who got there first.
 *
 * The client is defaulted rather than required so callers don't have to import
 * raw prisma to use this — `/api/signup` must not, and the structural guard in
 * `isolationGuards.test.ts` enforces that no route does. Tests pass a stub.
 */
export async function provisionFirm(
  input: ProvisionFirmInput,
  db: Db = prisma
): Promise<ProvisionedFirm> {
  const email = input.email.trim().toLowerCase();

  // Checked up front for a clear message. It's still checked by the unique
  // index below, which is what actually prevents a duplicate under a race.
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new EmailTakenError();
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const base = slugify(input.firmName);

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = nextSlugCandidate(base, attempt);

    try {
      return await db.$transaction(async (tx) => {
        const firm = await tx.firm.create({
          data: {
            name: input.firmName.trim(),
            slug,
            // New firms start on trial; DES-27's lifecycle takes it from here.
            status: 'TRIAL',
            plan: input.plan ?? null,
          },
        });
        const firmId = firm.id;

        await applyFirmDefaults(tx, firmId, input.firmName.trim());

        const user = await tx.user.create({
          data: {
            firmId,
            email,
            passwordHash,
            name: input.adminName.trim(),
            // Whoever signs the firm up runs it.
            role: 'ADMIN',
          },
        });

        return { firmId, userId: user.id, slug };
      });
    } catch (error) {
      // Someone took this slug between our attempt and the insert: try the next.
      if (isUniqueViolation(error, 'slug')) continue;

      // Or took the email, in the window after the check above.
      if (isUniqueViolation(error, 'email')) throw new EmailTakenError();

      throw error;
    }
  }

  throw new Error(`Could not find an available handle for "${input.firmName}".`);
}
