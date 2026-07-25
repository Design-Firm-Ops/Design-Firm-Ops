import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { prismaMock } from '@/test/prisma';
import { seedSuperAdmin } from '@/server/superAdmin';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

const ENV = { ...process.env };

beforeEach(() => {
  prismaMock.reset();
  process.env.SEED_SUPER_ADMIN_EMAIL = 'ops@designfirmops.app';
  process.env.SEED_SUPER_ADMIN_PASSWORD = 'a-long-random-password';
});

afterEach(() => {
  process.env = { ...ENV };
});

/** The upsert payload the seed submitted. */
function upsertArgs() {
  return prismaMock.user.upsert.mock.calls[0][0] as {
    where: { email: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  };
}

describe('seedSuperAdmin', () => {
  it('creates the operator on a fresh database', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await seedSuperAdmin(prismaMock as never);

    expect(result).toEqual({ status: 'seeded', email: 'ops@designfirmops.app', created: true });
    expect(upsertArgs().create).toMatchObject({
      email: 'ops@designfirmops.app',
      role: 'SUPER_ADMIN',
      firmId: null,
    });
  });

  // The acceptance criterion: re-running a deploy must not mint a second one.
  it('upserts rather than inserting when the operator already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    const result = await seedSuperAdmin(prismaMock as never);

    expect(result).toEqual({ status: 'seeded', email: 'ops@designfirmops.app', created: false });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(upsertArgs().where).toEqual({ email: 'ops@designfirmops.app' });
  });

  it('rotates the password from the environment on every run', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    await seedSuperAdmin(prismaMock as never);

    const hash = upsertArgs().update.passwordHash as string;
    expect(hash).not.toBe('a-long-random-password');
    expect(await bcrypt.compare('a-long-random-password', hash)).toBe(true);
  });

  // If the account were ever edited into a firm, the next deploy must put it
  // back — otherwise the platform operator quietly becomes a firm member.
  it('re-asserts role and firmId on update, not just the password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    await seedSuperAdmin(prismaMock as never);

    expect(upsertArgs().update).toMatchObject({ role: 'SUPER_ADMIN', firmId: null });
  });

  it('never gives the operator a firm', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await seedSuperAdmin(prismaMock as never);

    expect(upsertArgs().create.firmId).toBeNull();
    expect(upsertArgs().update.firmId).toBeNull();
  });

  it('normalizes the email so case and padding cannot create a second account', async () => {
    process.env.SEED_SUPER_ADMIN_EMAIL = '  OPS@DesignFirmOps.App  ';
    prismaMock.user.findUnique.mockResolvedValue(null);

    await seedSuperAdmin(prismaMock as never);
    expect(upsertArgs().where).toEqual({ email: 'ops@designfirmops.app' });
  });

  describe('when the environment is not configured', () => {
    it('skips without touching the database when the email is unset', async () => {
      delete process.env.SEED_SUPER_ADMIN_EMAIL;

      const result = await seedSuperAdmin(prismaMock as never);

      expect(result).toEqual({ status: 'skipped', reason: 'SEED_SUPER_ADMIN_EMAIL is not set' });
      expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    });

    it('skips when the password is unset', async () => {
      delete process.env.SEED_SUPER_ADMIN_PASSWORD;

      const result = await seedSuperAdmin(prismaMock as never);

      expect(result).toEqual({ status: 'skipped', reason: 'SEED_SUPER_ADMIN_PASSWORD is not set' });
      expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    });

    it('treats a blank email as unset', async () => {
      process.env.SEED_SUPER_ADMIN_EMAIL = '   ';
      expect((await seedSuperAdmin(prismaMock as never)).status).toBe('skipped');
    });
  });
});
