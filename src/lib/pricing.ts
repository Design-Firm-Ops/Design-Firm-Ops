// MDI Studio — pricing engine.
//
// This is the core of the business: every dollar amount here uses
// decimal.js (never native floats) and rounds to the cent at the same
// points a human bookkeeper would, so results are reproducible and
// auditable line by line.
//
// Rounding rule: round each unit price to 2 decimals FIRST, then
// extend by quantity, then sum extended prices for the subtotal. Do
// not round only at the end — that produces off-by-a-cent totals that
// won't reconcile against a manually-built invoice.

import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type MarkupMode = 'MARKUP' | 'MARGIN';
export type TaxBase = 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING';

export type Money = Decimal;

/** Round to 2 decimal places (the cent), half-up. */
export function toCents(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * The per-unit price the client is billed, given cost, any per-unit
 * platform fee, and a markup expressed either as a markup % (on cost)
 * or a margin % (of price). Rounded to the cent — this is the number
 * that appears on the invoice line.
 */
export function clientUnitPrice(params: {
  unitCost: Decimal.Value;
  platformFee: Decimal.Value;
  markupPct: Decimal.Value;
  markupMode: MarkupMode;
}): Decimal {
  const base = new Decimal(params.unitCost).plus(params.platformFee);
  const m = new Decimal(params.markupPct).dividedBy(100);

  if (params.markupMode === 'MARGIN') {
    // price = cost / (1 - m). A 100%+ margin is nonsensical; guard it.
    const divisor = new Decimal(1).minus(m);
    if (divisor.lessThanOrEqualTo(0)) {
      throw new Error('Margin must be less than 100%');
    }
    return toCents(base.dividedBy(divisor));
  }

  // markup: price = cost * (1 + m)
  return toCents(base.times(new Decimal(1).plus(m)));
}

/** clientUnitPrice x qty, rounded to the cent. */
export function extendedPrice(unitPrice: Decimal.Value, qty: number): Decimal {
  return toCents(new Decimal(unitPrice).times(qty));
}

/** (unitCost + platformFee) x qty — what MDI actually pays out, rounded to the cent. */
export function extendedCost(params: {
  unitCost: Decimal.Value;
  platformFee: Decimal.Value;
  qty: number;
}): Decimal {
  return toCents(new Decimal(params.unitCost).plus(params.platformFee).times(params.qty));
}

export interface PricedLine {
  unitPrice: Decimal;
  extended: Decimal;
  extendedCost: Decimal;
  profit: Decimal;
}

/**
 * Prices a single line item, resolving markup % / mode from the item's
 * own override or falling back to the project default.
 */
export function priceLine(params: {
  unitCost: Decimal.Value;
  platformFee: Decimal.Value;
  qty: number;
  markupPct: Decimal.Value | null | undefined;
  markupMode: MarkupMode | null | undefined;
  projectDefaultMarkupPct: Decimal.Value;
  projectMarkupMode: MarkupMode;
}): PricedLine {
  const markupPct = params.markupPct ?? params.projectDefaultMarkupPct;
  const markupMode = params.markupMode ?? params.projectMarkupMode;

  const unitPrice = clientUnitPrice({
    unitCost: params.unitCost,
    platformFee: params.platformFee,
    markupPct,
    markupMode,
  });
  const extended = extendedPrice(unitPrice, params.qty);
  const cost = extendedCost({ unitCost: params.unitCost, platformFee: params.platformFee, qty: params.qty });

  return {
    unitPrice,
    extended,
    extendedCost: cost,
    profit: extended.minus(cost),
  };
}

export interface InvoiceTotals {
  merchandiseSubtotal: Decimal;
  shippingTotal: Decimal;
  taxBaseAmount: Decimal;
  taxRate: Decimal;
  tax: Decimal;
  grandTotal: Decimal;
}

/**
 * Rolls a set of already-priced (extended) line amounts up into full
 * invoice totals: merch subtotal + shipping + tax (on a configurable
 * base) = grand total.
 */
export function computeInvoiceTotals(params: {
  extendedPrices: Decimal.Value[];
  shippingTotal: Decimal.Value;
  taxRate: Decimal.Value;
  taxBase: TaxBase;
}): InvoiceTotals {
  const merchandiseSubtotal = toCents(
    params.extendedPrices.reduce<Decimal>((sum, v) => sum.plus(v), new Decimal(0))
  );
  const shippingTotal = toCents(params.shippingTotal);
  const taxRate = new Decimal(params.taxRate);

  const taxBaseAmount =
    params.taxBase === 'MERCH_PLUS_SHIPPING'
      ? merchandiseSubtotal.plus(shippingTotal)
      : merchandiseSubtotal;

  const tax = toCents(taxBaseAmount.times(taxRate));
  const grandTotal = merchandiseSubtotal.plus(shippingTotal).plus(tax);

  return {
    merchandiseSubtotal,
    shippingTotal,
    taxBaseAmount: toCents(taxBaseAmount),
    taxRate,
    tax,
    grandTotal,
  };
}
