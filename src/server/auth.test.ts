import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { prismaMock } from '@/test/prisma';
import { authOptions } from '@/server/auth';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// The credentials sign-in check. Every rejection path returns null rather than
// throwing, so a caller can't distinguish "no such user" from "wrong password"
// — and none of them may accidentally return a user.

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
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'madison@example.com' } });
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
