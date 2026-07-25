import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test/prisma';
import { resolvePermissions } from '@/server/permissions';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

const FIRM = 'firm-1';



// The policy itself is covered without a database in lib/permissions.test.ts.
// This covers only the loading half: which rows it fetches, and for whom.

const designer = { user: { id: 'u1', role: 'DESIGNER', firmId: FIRM } } as never;
const admin = { user: { id: 'u2', role: 'ADMIN', firmId: FIRM } } as never;

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

  // A signed-out request now fails closed rather than resolving to designer
  // defaults — those defaults still grant procurement, documents and invoices,
  // which is not an answer a session with no tenant should get.
  it('refuses a session with no firm rather than falling back to defaults', async () => {
    await expect(resolvePermissions(null)).rejects.toThrow(/no firm/i);
    expect(prismaMock.settings.findUnique).not.toHaveBeenCalled();
  });

  it('refuses a super-admin, who belongs to no firm', async () => {
    const superAdmin = { user: { id: 'u3', role: 'SUPER_ADMIN', firmId: null } } as never;
    await expect(resolvePermissions(superAdmin)).rejects.toThrow(/platform operator/i);
  });
});
