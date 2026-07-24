import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/test/prisma';
import { recalculateInvoiceStatus } from '@/server/invoiceStatus';

vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));

// The money-to-status rule. This runs after every payment create/update/delete,
// and it must be able to move a status in *both* directions — correcting a
// payment downward has to un-PAY an invoice.

const project = { defaultMarkupPct: '0', markupMode: 'MARKUP' };

/** An invoice totalling $100: one item at cost, no markup, no shipping or tax. */
function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    type: 'PROCUREMENT',
    status: 'SENT',
    issuedDate: new Date('2026-01-01'),
    shippingTotal: '0',
    taxRate: '0',
    taxBase: 'MERCH_ONLY',
    project,
    items: [{ unitCost: '100', platformFee: '0', qty: 1, markupPct: '0', markupMode: 'MARKUP' }],
    designFeeCharges: [],
    payments: [],
    ...overrides,
  };
}

function payment(amount: string, category = 'MERCHANDISE') {
  return { amount, category };
}

/** The status the code decided to persist, or null if it left the invoice alone. */
function persistedStatus() {
  const call = prismaMock.invoice.update.mock.calls[0];
  return call ? (call[0] as { data: { status: string } }).data.status : null;
}

beforeEach(() => {
  prismaMock.reset();
});

describe('recalculateInvoiceStatus', () => {
  it('marks an invoice PAID once payments cover the total', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ payments: [payment('100')] }));
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('PAID');
  });

  it('marks it PAID on an overpayment too', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ payments: [payment('150')] }));
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('PAID');
  });

  it('marks it PARTIALLY_PAID for anything short of the total', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ payments: [payment('40')] }));
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('PARTIALLY_PAID');
  });

  it('is short by a cent, not paid', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ payments: [payment('99.99')] }));
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('PARTIALLY_PAID');
  });

  it('sums multiple payments', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(
      invoice({ status: 'PARTIALLY_PAID', payments: [payment('60'), payment('40')] })
    );
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('PAID');
  });

  // The reason this function exists rather than a one-way "mark paid".
  it('un-pays an invoice when a payment is corrected downward', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ status: 'PAID', payments: [payment('30')] }));
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('PARTIALLY_PAID');
  });

  it('falls back to SENT when every payment is removed from an issued invoice', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ status: 'PAID', payments: [] }));
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('SENT');
  });

  it('falls back to DRAFT when the invoice was never issued', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(
      invoice({ status: 'PARTIALLY_PAID', issuedDate: null, payments: [] })
    );
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('DRAFT');
  });

  it('never touches a VOID invoice', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ status: 'VOID', payments: [payment('100')] }));
    await recalculateInvoiceStatus('inv-1');
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });

  it('does nothing when the invoice does not exist', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    await expect(recalculateInvoiceStatus('missing')).resolves.toBeUndefined();
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });

  it('does not write when the status is already correct', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ status: 'PAID', payments: [payment('100')] }));
    await recalculateInvoiceStatus('inv-1');
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });

  // A zero-total invoice with no payments must not be "paid" — that would let
  // an empty invoice claim to be settled. It resolves to its issued state.
  it('does not call a zero-total invoice PAID', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ status: 'DRAFT', items: [], payments: [] }));
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('SENT');
    expect(persistedStatus()).not.toBe('PAID');
  });

  it('leaves an unissued, empty invoice at DRAFT', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(
      invoice({ status: 'DRAFT', issuedDate: null, items: [], payments: [] })
    );
    await recalculateInvoiceStatus('inv-1');
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });

  describe('payment categories', () => {
    it('ignores design fee payments against a procurement invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(
        invoice({ payments: [payment('100', 'DESIGN_FEE')] })
      );
      await recalculateInvoiceStatus('inv-1');
      // The design fee payment doesn't count, so it stays at its issued state.
      expect(persistedStatus()).toBeNull();
    });

    it('ignores merchandise payments against a design fee invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(
        invoice({
          type: 'DESIGN_FEE',
          items: [],
          designFeeCharges: [{ amount: '500' }],
          payments: [payment('500', 'MERCHANDISE')],
        })
      );
      await recalculateInvoiceStatus('inv-1');
      expect(persistedStatus()).toBeNull();
    });

    it('pays a design fee invoice from its own charges and payments', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(
        invoice({
          type: 'DESIGN_FEE',
          items: [],
          designFeeCharges: [{ amount: '300' }, { amount: '200' }],
          payments: [payment('500', 'DESIGN_FEE')],
        })
      );
      await recalculateInvoiceStatus('inv-1');
      expect(persistedStatus()).toBe('PAID');
    });
  });

  it('includes shipping and tax in the amount that must be covered', async () => {
    const withExtras = invoice({
      shippingTotal: '20',
      taxRate: '0.10',
      taxBase: 'MERCH_ONLY',
      payments: [payment('100')],
    });
    // 100 merch + 20 shipping + 10 tax = 130, so 100 is only partial.
    prismaMock.invoice.findUnique.mockResolvedValue(withExtras);
    await recalculateInvoiceStatus('inv-1');
    expect(persistedStatus()).toBe('PARTIALLY_PAID');
  });

  it('updates the invoice it was asked about', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice({ id: 'inv-9', payments: [payment('100')] }));
    await recalculateInvoiceStatus('inv-9');
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-9' },
      data: { status: 'PAID' },
    });
  });
});
