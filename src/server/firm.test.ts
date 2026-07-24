import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test/prisma';
import { currentFirmId, projectFirmId, resetCurrentFirmCache } from '@/server/firm';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// The temporary bridge that stands in for session-derived tenancy until
// DES-#2. Its job is narrow but load-bearing: never invent a tenant.

beforeEach(() => {
  prismaMock.reset();
  resetCurrentFirmCache();
});

describe('currentFirmId', () => {
  it('resolves the firm', async () => {
    prismaMock.firm.findFirst.mockResolvedValue({ id: 'firm-1' });
    expect(await currentFirmId()).toBe('firm-1');
  });

  it('picks the oldest firm deterministically', async () => {
    prismaMock.firm.findFirst.mockResolvedValue({ id: 'firm-1' });
    await currentFirmId();
    expect(prismaMock.firm.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  });

  it('memoizes so it does not query per call', async () => {
    prismaMock.firm.findFirst.mockResolvedValue({ id: 'firm-1' });
    await currentFirmId();
    await currentFirmId();
    await currentFirmId();
    expect(prismaMock.firm.findFirst).toHaveBeenCalledTimes(1);
  });

  // The important one: with no firm, failing loudly beats inventing a tenant
  // and silently writing rows into it.
  it('throws when no firm exists rather than fabricating one', async () => {
    prismaMock.firm.findFirst.mockResolvedValue(null);
    await expect(currentFirmId()).rejects.toThrow(/No Firm row exists/);
  });

  it('points at the fix in its error message', async () => {
    prismaMock.firm.findFirst.mockResolvedValue(null);
    await expect(currentFirmId()).rejects.toThrow(/prisma:migrate/);
  });

  it('does not cache a failure', async () => {
    prismaMock.firm.findFirst.mockResolvedValueOnce(null);
    await expect(currentFirmId()).rejects.toThrow();

    prismaMock.firm.findFirst.mockResolvedValue({ id: 'firm-1' });
    expect(await currentFirmId()).toBe('firm-1');
  });
});

describe('projectFirmId', () => {
  it('takes the firm from the parent project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ firmId: 'firm-9' });
    expect(await projectFirmId('p1')).toBe('firm-9');
  });

  // This is what keeps the denormalized firmId on Invoice/Item/Payment equal
  // to their project's — it is read from the parent, never from the ambient
  // current firm.
  it('ignores the ambient current firm entirely', async () => {
    prismaMock.firm.findFirst.mockResolvedValue({ id: 'firm-1' });
    prismaMock.project.findUnique.mockResolvedValue({ firmId: 'firm-OTHER' });

    expect(await projectFirmId('p1')).toBe('firm-OTHER');
    expect(prismaMock.firm.findFirst).not.toHaveBeenCalled();
  });

  it('throws for a project that does not exist', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);
    await expect(projectFirmId('missing')).rejects.toThrow(/No project missing/);
  });
});
