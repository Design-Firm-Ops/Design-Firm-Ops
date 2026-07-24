import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test/prisma';
import { nextInvoiceNumber } from '@/server/invoiceNumber';
import { nextItemTag } from '@/server/itemTag';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// Both of these produce identifiers a human reads and types back to you, so
// the formatting and the scoping both matter.

beforeEach(() => {
  prismaMock.reset();
});

describe('nextInvoiceNumber', () => {
  it('starts at 001 and zero-pads to three digits', async () => {
    prismaMock.invoice.count.mockResolvedValue(0);
    expect(await nextInvoiceNumber('p1', 'MDI')).toBe('MDI-001');

    prismaMock.invoice.count.mockResolvedValue(8);
    expect(await nextInvoiceNumber('p1', 'MDI')).toBe('MDI-009');
  });

  it('keeps going past three digits rather than truncating', async () => {
    prismaMock.invoice.count.mockResolvedValue(999);
    expect(await nextInvoiceNumber('p1', 'MDI')).toBe('MDI-1000');
  });

  it('falls back to INV when the project has no prefix', async () => {
    prismaMock.invoice.count.mockResolvedValue(0);
    expect(await nextInvoiceNumber('p1', null)).toBe('INV-001');
    expect(await nextInvoiceNumber('p1', '')).toBe('INV-001');
    expect(await nextInvoiceNumber('p1', '   ')).toBe('INV-001');
  });

  it('trims a padded prefix', async () => {
    prismaMock.invoice.count.mockResolvedValue(0);
    expect(await nextInvoiceNumber('p1', '  MDI  ')).toBe('MDI-001');
  });

  it('gives design fee invoices their own DF sequence', async () => {
    prismaMock.invoice.count.mockResolvedValue(2);
    expect(await nextInvoiceNumber('p1', 'MDI', 'DESIGN_FEE')).toBe('MDI-DF-003');
  });

  // The reason the two types are counted separately: numbering them together
  // would make one sequence skip numbers whenever the other was used.
  it('counts each type independently, so the sequences never interfere', async () => {
    await nextInvoiceNumber('p1', 'MDI', 'PROCUREMENT');
    expect(prismaMock.invoice.count).toHaveBeenLastCalledWith({
      where: { projectId: 'p1', type: 'PROCUREMENT' },
    });

    await nextInvoiceNumber('p1', 'MDI', 'DESIGN_FEE');
    expect(prismaMock.invoice.count).toHaveBeenLastCalledWith({
      where: { projectId: 'p1', type: 'DESIGN_FEE' },
    });
  });

  it('defaults to a procurement invoice', async () => {
    prismaMock.invoice.count.mockResolvedValue(0);
    expect(await nextInvoiceNumber('p1', 'MDI')).not.toContain('DF');
  });

  it('scopes numbering to one project', async () => {
    await nextInvoiceNumber('project-42', 'MDI');
    expect(prismaMock.invoice.count).toHaveBeenCalledWith({
      where: { projectId: 'project-42', type: 'PROCUREMENT' },
    });
  });
});

describe('nextItemTag', () => {
  it('numbers from 1 within a project, using the type prefix', async () => {
    prismaMock.itemTypeOption.findUnique.mockResolvedValue({ id: 't1', tagPrefix: 'TA' });
    prismaMock.item.count.mockResolvedValue(0);
    expect(await nextItemTag('p1', 't1')).toBe('TA-1');

    prismaMock.item.count.mockResolvedValue(4);
    expect(await nextItemTag('p1', 't1')).toBe('TA-5');
  });

  it('returns null for an unknown item type rather than inventing a tag', async () => {
    prismaMock.itemTypeOption.findUnique.mockResolvedValue(null);
    expect(await nextItemTag('p1', 'missing')).toBeNull();
    expect(prismaMock.item.count).not.toHaveBeenCalled();
  });

  it('counts only this project and this item type', async () => {
    prismaMock.itemTypeOption.findUnique.mockResolvedValue({ id: 't1', tagPrefix: 'SC' });
    await nextItemTag('p9', 't1');
    expect(prismaMock.item.count).toHaveBeenCalledWith({ where: { projectId: 'p9', itemTypeId: 't1' } });
  });
});
