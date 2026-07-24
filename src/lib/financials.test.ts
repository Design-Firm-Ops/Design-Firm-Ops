import { describe, it, expect } from 'vitest';
import {
  priceItem,
  invoiceExtendedPrices,
  invoiceTotals,
  summarizeProjectFinancials,
  summarizeDesignFee,
  type PricableItem,
  type TotalableInvoice,
} from '@/lib/financials';

const project = { defaultMarkupPct: '15', markupMode: 'MARKUP' as const };

/** A line item priced at 100 + 10 fee, qty 2 — 126.50/unit, 253.00 extended at the 15% project default. */
function item(overrides: Partial<PricableItem> = {}): PricableItem {
  return { unitCost: '100', platformFee: '10', qty: 2, markupPct: null, markupMode: null, ...overrides };
}

function invoice(overrides: Partial<TotalableInvoice> = {}): TotalableInvoice {
  return {
    type: 'PROCUREMENT',
    status: 'SENT',
    shippingTotal: '0',
    taxRate: '0',
    taxBase: 'MERCH_ONLY',
    items: [],
    designFeeCharges: [],
    ...overrides,
  };
}

describe('priceItem', () => {
  it('prices an item against the project markup defaults', () => {
    const line = priceItem(item(), project);
    expect(line.unitPrice.toFixed(2)).toBe('126.50');
    expect(line.extended.toFixed(2)).toBe('253.00');
    expect(line.extendedCost.toFixed(2)).toBe('220.00');
    expect(line.profit.toFixed(2)).toBe('33.00');
  });

  it('prefers the item-level markup override', () => {
    const line = priceItem(item({ markupPct: '50', markupMode: 'MARKUP' }), project);
    expect(line.unitPrice.toFixed(2)).toBe('165.00');
  });

  // Client row types carry markupMode as a plain string; it should resolve
  // without the caller having to cast it.
  it('accepts a loosely-typed markupMode string', () => {
    const line = priceItem(item({ markupPct: '20', markupMode: 'MARGIN' as string }), project);
    // (100 + 10) / (1 - 0.20) = 137.50
    expect(line.unitPrice.toFixed(2)).toBe('137.50');
  });

  it('falls back to the project default when markupMode is not a recognized value', () => {
    const line = priceItem(item({ markupPct: '15', markupMode: 'GARBAGE' as string }), project);
    // Treated as the project's MARKUP mode, not silently mis-priced as a margin.
    expect(line.unitPrice.toFixed(2)).toBe('126.50');
  });
});

describe('invoiceExtendedPrices', () => {
  it('prices line items for a procurement invoice', () => {
    const prices = invoiceExtendedPrices(invoice({ items: [item(), item({ qty: 1 })] }), project);
    expect(prices.map((p) => p.toFixed(2))).toEqual(['253.00', '126.50']);
  });

  it('uses charge amounts directly for a design fee invoice', () => {
    const prices = invoiceExtendedPrices(
      invoice({ type: 'DESIGN_FEE', designFeeCharges: [{ amount: '500' }, { amount: '250.55' }] }),
      project
    );
    // Design fee charges are billed at face value — never marked up.
    expect(prices.map((p) => p.toFixed(2))).toEqual(['500.00', '250.55']);
  });

  it('ignores items on a design fee invoice and charges on a procurement invoice', () => {
    const both = { items: [item()], designFeeCharges: [{ amount: '999' }] };
    expect(invoiceExtendedPrices(invoice({ type: 'DESIGN_FEE', ...both }), project).map((p) => p.toFixed(2))).toEqual([
      '999.00',
    ]);
    expect(invoiceExtendedPrices(invoice({ type: 'PROCUREMENT', ...both }), project).map((p) => p.toFixed(2))).toEqual([
      '253.00',
    ]);
  });

  it('returns an empty list when there are no lines', () => {
    expect(invoiceExtendedPrices(invoice(), project)).toEqual([]);
  });
});

describe('invoiceTotals', () => {
  it('rolls line items up through shipping and tax', () => {
    const totals = invoiceTotals(
      invoice({ items: [item()], shippingTotal: '50', taxRate: '0.07', taxBase: 'MERCH_ONLY' }),
      project
    );
    // merch 253.00, shipping 50.00, tax 253.00 * 0.07 = 17.71, grand 320.71
    expect(totals.merchandiseSubtotal.toFixed(2)).toBe('253.00');
    expect(totals.tax.toFixed(2)).toBe('17.71');
    expect(totals.grandTotal.toFixed(2)).toBe('320.71');
  });

  it('reproduces the reference invoice totals from the seed demo project', () => {
    // Same reference as pricing.test.ts, but driven end-to-end through
    // invoiceTotals so the extraction is pinned to the known-good numbers.
    const totals = invoiceTotals(
      invoice({
        items: [{ unitCost: '19287.85', platformFee: '0', qty: 1, markupPct: '0', markupMode: 'MARKUP' }],
        shippingTotal: '2295.48',
        taxRate: '0.07',
        taxBase: 'MERCH_ONLY',
      }),
      project
    );
    expect(totals.merchandiseSubtotal.toFixed(2)).toBe('19287.85');
    expect(totals.shippingTotal.toFixed(2)).toBe('2295.48');
    expect(totals.tax.toFixed(2)).toBe('1350.15');
    expect(totals.grandTotal.toFixed(2)).toBe('22933.48');
  });
});

describe('summarizeProjectFinancials', () => {
  it('sums non-void procurement invoices against merchandise payments', () => {
    const summary = summarizeProjectFinancials({
      ...project,
      invoices: [invoice({ items: [item()] }), invoice({ items: [item({ qty: 1 })] })],
      payments: [{ category: 'MERCHANDISE', amount: '100' }],
    });
    // billed 253.00 + 126.50 = 379.50, paid 100.00
    expect(summary.invoicedTotal.toFixed(2)).toBe('379.50');
    expect(summary.paidTotal.toFixed(2)).toBe('100.00');
    expect(summary.outstanding.toFixed(2)).toBe('279.50');
  });

  it('excludes voided invoices', () => {
    const summary = summarizeProjectFinancials({
      ...project,
      invoices: [invoice({ items: [item()] }), invoice({ status: 'VOID', items: [item()] })],
      payments: [],
    });
    expect(summary.invoicedTotal.toFixed(2)).toBe('253.00');
  });

  it('excludes design fee invoices and design fee payments', () => {
    const summary = summarizeProjectFinancials({
      ...project,
      invoices: [
        invoice({ items: [item()] }),
        invoice({ type: 'DESIGN_FEE', designFeeCharges: [{ amount: '1000' }] }),
      ],
      payments: [
        { category: 'MERCHANDISE', amount: '50' },
        { category: 'DESIGN_FEE', amount: '900' },
      ],
    });
    expect(summary.invoicedTotal.toFixed(2)).toBe('253.00');
    expect(summary.paidTotal.toFixed(2)).toBe('50.00');
    expect(summary.outstanding.toFixed(2)).toBe('203.00');
  });

  it('reports a negative outstanding when overpaid', () => {
    const summary = summarizeProjectFinancials({
      ...project,
      invoices: [invoice({ items: [item()] })],
      payments: [{ category: 'MERCHANDISE', amount: '300' }],
    });
    expect(summary.outstanding.toFixed(2)).toBe('-47.00');
  });

  it('is all zeroes for a project with no invoices or payments', () => {
    const summary = summarizeProjectFinancials({ ...project, invoices: [], payments: [] });
    expect(summary.invoicedTotal.toFixed(2)).toBe('0.00');
    expect(summary.paidTotal.toFixed(2)).toBe('0.00');
    expect(summary.outstanding.toFixed(2)).toBe('0.00');
  });
});

describe('summarizeDesignFee', () => {
  it('sums non-void design fee invoices against design fee payments', () => {
    const summary = summarizeDesignFee({
      invoices: [
        invoice({ type: 'DESIGN_FEE', designFeeCharges: [{ amount: '1000' }, { amount: '500' }] }),
        invoice({ type: 'DESIGN_FEE', status: 'VOID', designFeeCharges: [{ amount: '9999' }] }),
        invoice({ items: [item()] }),
      ],
      payments: [
        { category: 'DESIGN_FEE', amount: '400' },
        { category: 'MERCHANDISE', amount: '250' },
      ],
    });
    expect(summary.billed.toFixed(2)).toBe('1500.00');
    expect(summary.paid.toFixed(2)).toBe('400.00');
    expect(summary.outstanding.toFixed(2)).toBe('1100.00');
  });

  it('includes shipping and tax carried on a design fee invoice', () => {
    const summary = summarizeDesignFee({
      invoices: [
        invoice({
          type: 'DESIGN_FEE',
          designFeeCharges: [{ amount: '1000' }],
          shippingTotal: '25',
          taxRate: '0.05',
          taxBase: 'MERCH_ONLY',
        }),
      ],
      payments: [],
    });
    // 1000 + 25 shipping + 50 tax
    expect(summary.billed.toFixed(2)).toBe('1075.00');
  });
});
