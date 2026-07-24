import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test/prisma';
import { resolvePermissions } from '@/server/permissions';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// Tenancy is not on the session yet (DES-#2), so the firm is resolved by
// `currentFirmId()`. Stub it: these tests are about the find-or-create
// behaviour, not about how the firm is discovered.
const FIRM = 'firm-1';
vi.mock('@/server/firm', () => ({ currentFirmId: async () => FIRM }));


// The policy itself is covered without a database in lib/permissions.test.ts.
// This covers only the loading half: which rows it fetches, and for whom.

const designer = { user: { id: 'u1', role: 'DESIGNER' } } as never;
const admin = { user: { id: 'u2', role: 'ADMIN' } } as never;

beforeEach(() => {
  prismaMock.reset();
});

describe('resolvePermissions', () => {
  it('short-circuits for an admin without querying at all', async () => {
    const perms = await resolvePermissions(admin);

    expect(perms.isAdmin).toBe(true);
    expect(perms.financials).toBe(true);
    // An admin's answer can't be changed by any stored setting, so paying for
    // the queries would be waste.
    expect(prismaMock.settings.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.userPermissionOverride.findUnique).not.toHaveBeenCalled();
  });

  it('loads the firm settings and this user’s override for a designer', async () => {
    prismaMock.settings.findUnique.mockResolvedValue({ designerCanViewFinancials: true });
    prismaMock.userPermissionOverride.findUnique.mockResolvedValue(null);

    const perms = await resolvePermissions(designer);

    expect(perms.isAdmin).toBe(false);
    expect(perms.financials).toBe(true);
    expect(prismaMock.settings.findUnique).toHaveBeenCalledWith({ where: { firmId: FIRM } });
    expect(prismaMock.userPermissionOverride.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('lets the user override beat the firm setting', async () => {
    prismaMock.settings.findUnique.mockResolvedValue({ designerCanViewFinancials: false });
    prismaMock.userPermissionOverride.findUnique.mockResolvedValue({ financials: true });

    expect((await resolvePermissions(designer)).financials).toBe(true);
  });

  it('falls back to the built-in defaults when nothing is stored', async () => {
    prismaMock.settings.findUnique.mockResolvedValue(null);
    prismaMock.userPermissionOverride.findUnique.mockResolvedValue(null);

    const perms = await resolvePermissions(designer);
    expect(perms.financials).toBe(false);
    expect(perms.vendorCredentials).toBe(false);
    expect(perms.procurement).toBe(true);
  });

  // A signed-out request must land on the most restrictive answer, not crash.
  it('treats a null session as a designer with no override', async () => {
    prismaMock.settings.findUnique.mockResolvedValue(null);

    const perms = await resolvePermissions(null);
    expect(perms.isAdmin).toBe(false);
    expect(perms.financials).toBe(false);
    expect(prismaMock.userPermissionOverride.findUnique).not.toHaveBeenCalled();
  });
});
