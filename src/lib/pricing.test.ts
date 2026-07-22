import { describe, it, expect } from 'vitest';
import {
  toCents,
  clientUnitPrice,
  extendedPrice,
  extendedCost,
  priceLine,
  computeInvoiceTotals,
} from '@/lib/pricing';

describe('toCents', () => {
  it('rounds half-up to the cent', () => {
    expect(toCents('1.005').toFixed(2)).toBe('1.01');
    expect(toCents('1.004').toFixed(2)).toBe('1.00');
    expect(toCents(2.5).toFixed(2)).toBe('2.50');
  });
});

describe('clientUnitPrice', () => {
  it('applies markup to cost plus platform fee', () => {
    // (100 + 10) * 1.15 = 126.50
    const price = clientUnitPrice({ unitCost: 100, platformFee: 10, markupPct: 15, markupMode: 'MARKUP' });
    expect(price.toFixed(2)).toBe('126.50');
  });

  it('applies margin as a fraction of price', () => {
    // price = 80 / (1 - 0.20) = 100.00
    const price = clientUnitPrice({ unitCost: 80, platformFee: 0, markupPct: 20, markupMode: 'MARGIN' });
    expect(price.toFixed(2)).toBe('100.00');
  });

  it('rejects a margin of 100% or more (division by zero / negative price)', () => {
    expect(() => clientUnitPrice({ unitCost: 50, platformFee: 0, markupPct: 100, markupMode: 'MARGIN' })).toThrow();
    expect(() => clientUnitPrice({ unitCost: 50, platformFee: 0, markupPct: 120, markupMode: 'MARGIN' })).toThrow();
  });
});

describe('extendedPrice / extendedCost', () => {
  it('multiplies a per-unit amount by quantity, rounded to the cent', () => {
    expect(extendedPrice('126.50', 4).toFixed(2)).toBe('506.00');
    expect(extendedCost({ unitCost: 100, platformFee: 10, qty: 4 }).toFixed(2)).toBe('440.00');
  });
});

describe('priceLine', () => {
  it('falls back to the project defaults when the item has no override', () => {
    const line = priceLine({
      unitCost: 100,
      platformFee: 0,
      qty: 2,
      markupPct: null,
      markupMode: null,
      projectDefaultMarkupPct: 15,
      projectMarkupMode: 'MARKUP',
    });
    // unit 115.00, extended 230.00, cost 200.00, profit 30.00
    expect(line.unitPrice.toFixed(2)).toBe('115.00');
    expect(line.extended.toFixed(2)).toBe('230.00');
    expect(line.extendedCost.toFixed(2)).toBe('200.00');
    expect(line.profit.toFixed(2)).toBe('30.00');
  });

  it('prefers the item override over the project default', () => {
    const line = priceLine({
      unitCost: 100,
      platformFee: 0,
      qty: 1,
      markupPct: 50,
      markupMode: 'MARKUP',
      projectDefaultMarkupPct: 15,
      projectMarkupMode: 'MARKUP',
    });
    expect(line.unitPrice.toFixed(2)).toBe('150.00');
  });
});

describe('computeInvoiceTotals', () => {
  it('reproduces the reference invoice totals from the seed demo project', () => {
    // Seed reference: subtotal $19,287.85, shipping $2,295.48,
    // 7% tax $1,350.15 (on merch only), grand total $22,933.48.
    const totals = computeInvoiceTotals({
      extendedPrices: ['19287.85'],
      shippingTotal: '2295.48',
      taxRate: '0.07',
      taxBase: 'MERCH_ONLY',
    });
    expect(totals.merchandiseSubtotal.toFixed(2)).toBe('19287.85');
    expect(totals.shippingTotal.toFixed(2)).toBe('2295.48');
    expect(totals.tax.toFixed(2)).toBe('1350.15');
    expect(totals.grandTotal.toFixed(2)).toBe('22933.48');
  });

  it('taxes shipping too when the base is MERCH_PLUS_SHIPPING', () => {
    const totals = computeInvoiceTotals({
      extendedPrices: ['1000.00'],
      shippingTotal: '100.00',
      taxRate: '0.10',
      taxBase: 'MERCH_PLUS_SHIPPING',
    });
    // tax on (1000 + 100) * 0.10 = 110.00; grand = 1000 + 100 + 110 = 1210.00
    expect(totals.taxBaseAmount.toFixed(2)).toBe('1100.00');
    expect(totals.tax.toFixed(2)).toBe('110.00');
    expect(totals.grandTotal.toFixed(2)).toBe('1210.00');
  });

  it('sums extended prices for the subtotal', () => {
    const totals = computeInvoiceTotals({
      extendedPrices: ['10.10', '20.20', '30.30'],
      shippingTotal: '0',
      taxRate: '0',
      taxBase: 'MERCH_ONLY',
    });
    expect(totals.merchandiseSubtotal.toFixed(2)).toBe('60.60');
    expect(totals.grandTotal.toFixed(2)).toBe('60.60');
  });
});
