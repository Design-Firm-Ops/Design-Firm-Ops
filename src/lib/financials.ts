import Decimal from 'decimal.js';
import { computeInvoiceTotals, priceLine, toCents } from '@/lib/pricing';
import type { Item, Invoice, Payment, Project } from '@prisma/client';

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
 * Rolls a project's invoices up into invoiced / paid / outstanding
 * totals for the dashboard and project overview. Invoice totals are
 * computed live from each invoice's linked items (no line-item
 * snapshotting yet — see Invoice model comment).
 */
export function summarizeProjectFinancials(
  project: ProjectMarkupDefaults & {
    invoices: (Invoice & { items: Item[] })[];
    payments: Payment[];
  }
) {
  let invoicedTotal = new Decimal(0);

  for (const invoice of project.invoices) {
    const extendedPrices = invoice.items.map((item) => priceItem(item, project).extended);
    const totals = computeInvoiceTotals({
      extendedPrices,
      shippingTotal: invoice.shippingTotal,
      taxRate: invoice.taxRate,
      taxBase: invoice.taxBase,
    });
    invoicedTotal = invoicedTotal.plus(totals.grandTotal);
  }

  const paidTotal = toCents(project.payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));
  invoicedTotal = toCents(invoicedTotal);
  const outstanding = toCents(invoicedTotal.minus(paidTotal));

  return { invoicedTotal, paidTotal, outstanding };
}
