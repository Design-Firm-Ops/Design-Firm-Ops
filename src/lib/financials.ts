import Decimal from 'decimal.js';
import { computeInvoiceTotals, priceLine, toCents } from '@/lib/pricing';
import type { Item, Invoice, Payment, Project, DesignFeeCharge } from '@prisma/client';

type ProjectMarkupDefaults = Pick<Project, 'defaultMarkupPct' | 'markupMode'>;

/** Prices a single Item against its project's markup defaults. */
export function priceItem(item: Item, project: ProjectMarkupDefaults) {
  return priceLine({
    unitCost: item.unitCost,
    platformFee: item.platformFee,
    qty: item.qty,
    markupPct: item.markupPct,
    markupMode: item.markupMode,
    projectDefaultMarkupPct: project.defaultMarkupPct,
    projectMarkupMode: project.markupMode,
  });
}

/**
 * Rolls a project's merchandise invoices up into invoiced / paid /
 * outstanding totals. Invoice totals are computed live from each
 * invoice's linked items (no line-item snapshotting yet — see Invoice
 * model comment). Only MERCHANDISE-category payments count here —
 * design fee payments have their own ledger (see summarizeDesignFee).
 */
export function summarizeProjectFinancials(
  project: ProjectMarkupDefaults & {
    invoices: (Invoice & { items: Item[] })[];
    payments: Payment[];
  }
) {
  let invoicedTotal = new Decimal(0);

  // A voided invoice's items are detached and revert to APPROVED — it
  // never counted as real invoiced revenue in the first place.
  const liveInvoices = project.invoices.filter((invoice) => invoice.status !== 'VOID');

  for (const invoice of liveInvoices) {
    const extendedPrices = invoice.items.map((item) => priceItem(item, project).extended);
    const totals = computeInvoiceTotals({
      extendedPrices,
      shippingTotal: invoice.shippingTotal,
      taxRate: invoice.taxRate,
      taxBase: invoice.taxBase,
    });
    invoicedTotal = invoicedTotal.plus(totals.grandTotal);
  }

  const merchandisePayments = project.payments.filter((p) => p.category === 'MERCHANDISE');
  const paidTotal = toCents(merchandisePayments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));
  invoicedTotal = toCents(invoicedTotal);
  const outstanding = toCents(invoicedTotal.minus(paidTotal));

  return { invoicedTotal, paidTotal, outstanding };
}

/**
 * Rolls up the separate design fee ledger: what's been billed toward
 * the design fee, what's been paid against it, and what's outstanding.
 */
export function summarizeDesignFee(project: { designFeeCharges: DesignFeeCharge[]; payments: Payment[] }) {
  const billed = toCents(project.designFeeCharges.reduce((sum, c) => sum.plus(c.amount), new Decimal(0)));
  const designFeePayments = project.payments.filter((p) => p.category === 'DESIGN_FEE');
  const paid = toCents(designFeePayments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));
  const outstanding = toCents(billed.minus(paid));

  return { billed, paid, outstanding };
}
