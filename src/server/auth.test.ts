import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { prismaMock } from '@/test/prisma';
import { authOptions } from '@/server/auth';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// The credentials sign-in check.
//
// Every *credential* rejection returns null rather than throwing, so a caller
// can't distinguish "no such user" from "wrong password" — and none of them may
// accidentally return a user. The one path that throws is firm status, which
// runs only after the password is proven correct; see the DES-27 block below.

type Authorize = (credentials: Record<string, string> | undefined) => Promise<unknown>;
const authorize = (authOptions.providers[0] as unknown as { options: { authorize: Authorize } }).options.authorize;

const PASSWORD = 'correct-horse';
let passwordHash: string;

beforeEach(async () => {
  prismaMock.reset();
  passwordHash ||= await bcrypt.hash(PASSWORD, 4);
});

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'madison@example.com',
    name: 'Madison',
    role: 'ADMIN',
    active: true,
    passwordHash,
    ...overrides,
  };
}

describe('credentials authorize', () => {
  it('returns the user for a correct email and password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user());

    expect(await authorize({ email: 'madison@example.com', password: PASSWORD })).toEqual({
      id: 'u1',
      email: 'madison@example.com',
      name: 'Madison',
      role: 'ADMIN',
    });
  });

  // Never hand the password hash back to next-auth's session.
  it('never returns the password hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user());
    const result = (await authorize({ email: 'madison@example.com', password: PASSWORD })) as object;
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects a wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user());
    expect(await authorize({ email: 'madison@example.com', password: 'wrong' })).toBeNull();
  });

  it('rejects an unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await authorize({ email: 'nobody@example.com', password: PASSWORD })).toBeNull();
  });

  // A deactivated user must not be able to sign in even with the right password.
  it('rejects a deactivated user holding valid credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user({ active: false }));
    expect(await authorize({ email: 'madison@example.com', password: PASSWORD })).toBeNull();
  });

  it('rejects missing credentials without touching the database', async () => {
    expect(await authorize(undefined)).toBeNull();
    expect(await authorize({ email: '', password: PASSWORD })).toBeNull();
    expect(await authorize({ email: 'a@b.com', password: '' })).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('normalizes the email so case and padding do not lock people out', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user());
    await authorize({ email: '  MADISON@Example.COM  ', password: PASSWORD });
    // Only the `where` is the subject here; what else the query selects is
    // pinned by the firm-status test below.
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'madison@example.com' } })
    );
  });
});

describe('session wiring', () => {
  it('carries id and role from the user onto the token', async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await jwt({ token: {}, user: { id: 'u1', role: 'ADMIN' } } as never);
    expect(token).toMatchObject({ id: 'u1', role: 'ADMIN' });
  });

  it('leaves an existing token alone when there is no user', async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await jwt({ token: { id: 'u1', role: 'ADMIN' } } as never);
    expect(token).toMatchObject({ id: 'u1', role: 'ADMIN' });
  });

  it('exposes id and role on the session so permission checks can read them', async () => {
    const sessionCb = authOptions.callbacks!.session!;
    const session = await sessionCb({
      session: { user: { name: 'Madison' } },
      token: { id: 'u1', role: 'DESIGNER' },
    } as never);
    expect((session.user as { id: string; role: string }).id).toBe('u1');
    expect((session.user as { id: string; role: string }).role).toBe('DESIGNER');
  });
});

// Firm lifecycle (DES-27). Until now `Firm.status` existed and nothing read
// it: a suspended firm signed in exactly like an active one.
describe('firm status gates sign-in', () => {
  const withFirm = (status: string | null) =>
    user({ firmId: status ? 'firm-1' : null, firm: status ? { status } : null });

  it('lets an active or trialling firm in', async () => {
    for (const status of ['ACTIVE', 'TRIAL']) {
      prismaMock.user.findUnique.mockResolvedValue(withFirm(status));
      const result = await authorize({ email: 'madison@example.com', password: PASSWORD });
      expect(result, status).toMatchObject({ id: 'u1' });
    }
  });

  it('refuses a suspended firm, saying why', async () => {
    prismaMock.user.findUnique.mockResolvedValue(withFirm('SUSPENDED'));
    await expect(
      authorize({ email: 'madison@example.com', password: PASSWORD })
    ).rejects.toThrow('FIRM_SUSPENDED');
  });

  it('refuses a canceled firm, saying why', async () => {
    prismaMock.user.findUnique.mockResolvedValue(withFirm('CANCELED'));
    await expect(
      authorize({ email: 'madison@example.com', password: PASSWORD })
    ).rejects.toThrow('FIRM_CANCELED');
  });

  // THE ordering test. "This firm is suspended" is safe to say only because
  // it comes after the password check — otherwise it would confirm to anyone
  // guessing an address that the account exists and which firm it's in.
  it('does not reveal the firm status to someone with the wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(withFirm('SUSPENDED'));
    expect(await authorize({ email: 'madison@example.com', password: 'wrong' })).toBeNull();
  });

  it('does not reveal it for an inactive user either', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      user({ active: false, firmId: 'firm-1', firm: { status: 'SUSPENDED' } })
    );
    expect(await authorize({ email: 'madison@example.com', password: PASSWORD })).toBeNull();
  });

  // The platform operator belongs to no firm — there is no status to judge
  // them by, and denying them would strand the only account able to lift a
  // suspension.
  it('always admits a user with no firm', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      user({ role: 'SUPER_ADMIN', firmId: null, firm: null })
    );
    expect(await authorize({ email: 'madison@example.com', password: PASSWORD })).toMatchObject({
      role: 'SUPER_ADMIN',
    });
  });

  it('reads the firm status in the same query as the user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(withFirm('ACTIVE'));
    await authorize({ email: 'madison@example.com', password: PASSWORD });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ include: { firm: { select: { status: true } } } })
    );
  });
});
