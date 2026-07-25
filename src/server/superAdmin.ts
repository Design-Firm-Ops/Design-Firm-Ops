import bcrypt from 'bcryptjs';
import { prisma } from '@/server/prisma';

// Seeding the platform operator.
//
// There is exactly one SUPER_ADMIN and it is created at deploy time, never
// through the UI (plans/ADMIN_DASHBOARD.md §3.3). This lives in its own module
// rather than inside prisma/seed.ts so it can be unit-tested — seed.ts runs
// `main()` on import and can't be imported safely, the same reason
// scripts/pg.mjs exists.
//
// A partial unique index (`User_single_super_admin`, added in the DES-24
// migration) is the actual guarantee that a second one can't exist. This
// function's job is to be idempotent so deploys don't fight that constraint.

/** What the seed did, so the caller can report it accurately. */
export type SuperAdminSeedResult =
  | { status: 'skipped'; reason: string }
  | { status: 'seeded'; email: string; created: boolean };

/** Minimal shape of what this needs, so tests can pass a stub. */
type Db = Pick<typeof prisma, 'user'>;

/**
 * Creates or updates the single SUPER_ADMIN from `SEED_SUPER_ADMIN_*`.
 *
 * Idempotent: upserts by email, so re-running a deploy never duplicates the
 * account and rotates the password from the environment. `firmId` is always
 * null — a platform operator belongs to no firm.
 *
 * Skips when the env vars are absent rather than failing, so existing
 * single-firm setups and `npm run setup` keep working; the caller logs it.
 */
export async function seedSuperAdmin(db: Db = prisma): Promise<SuperAdminSeedResult> {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email) {
    return { status: 'skipped', reason: 'SEED_SUPER_ADMIN_EMAIL is not set' };
  }
  if (!password) {
    return { status: 'skipped', reason: 'SEED_SUPER_ADMIN_PASSWORD is not set' };
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  const passwordHash = await bcrypt.hash(password, 10);

  await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: 'Platform Operator',
      role: 'SUPER_ADMIN',
      // Explicit rather than omitted: a super-admin's lack of a firm is the
      // defining property of the role, not an oversight.
      firmId: null,
    },
    // Re-assert role and firmId, not just the password: if this account were
    // ever edited into a firm, the next deploy puts it back.
    update: { passwordHash, role: 'SUPER_ADMIN', firmId: null },
  });

  return { status: 'seeded', email, created: !existing };
}
