import Decimal from 'decimal.js';
import {
  computeInvoiceTotals,
  priceLine,
  toCents,
  type InvoiceTotals,
  type MarkupMode,
  type TaxBase,
} from '@/lib/pricing';
import { sumMoney } from '@/lib/money';

// Project/invoice-level money roll-ups. `pricing.ts` owns the per-line
// arithmetic; this module owns the question "what does this invoice — or
// this whole project — add up to", so the answer is the same everywhere
// it's asked (project dashboard, invoice list, PDF, status recalc, email).

/**
 * The minimum an item needs to be priced. Deliberately structural rather
 * than the Prisma `Item` type: the client tables and the PDF renderer hold
 * the same numbers as strings, and they need the same answer.
 */
export interface PricableItem {
  unitCost: Decimal.Value;
  platformFee: Decimal.Value;
  qty: number;
  markupPct?: Decimal.Value | null;
  // Widened to `string` because client row types carry it untyped — the
  // caller shouldn't have to cast, and an unrecognized value falls back to
  // the project default rather than being blindly treated as a markup.
  markupMode?: MarkupMode | string | null;
}

export interface ProjectMarkupDefaults {
  defaultMarkupPct: Decimal.Value;
  markupMode: MarkupMode | string;
}

/** The minimum an invoice needs for its totals. */
export interface TotalableInvoice {
  type?: string | null;
  status?: string | null;
  shippingTotal: Decimal.Value;
  taxRate: Decimal.Value;
  taxBase: TaxBase | string;
  items?: PricableItem[];
  designFeeCharges?: { amount: Decimal.Value }[];
}

interface LedgerPayment {
  category: string;
  amount: Decimal.Value;
}

function asMarkupMode(value: MarkupMode | string | null | undefined): MarkupMode | null {
  return value === 'MARGIN' || value === 'MARKUP' ? value : null;
}

function asTaxBase(value: TaxBase | string): TaxBase {
  return value === 'MERCH_PLUS_SHIPPING' ? 'MERCH_PLUS_SHIPPING' : 'MERCH_ONLY';
}

/** Prices a single item against its project's markup defaults. */
export function priceItem(item: PricableItem, project: ProjectMarkupDefaults) {
  return priceLine({
    unitCost: item.unitCost,
    platformFee: item.platformFee,
    qty: item.qty,
    markupPct: item.markupPct,
    markupMode: asMarkupMode(item.markupMode),
    projectDefaultMarkupPct: project.defaultMarkupPct,
    projectMarkupMode: asMarkupMode(project.markupMode) ?? 'MARKUP',
  });
}

/**
 * The extended (line) amounts an invoice bills for. A Design Fee Invoice
 * bills its charges at face value — design fees are never marked up — while
 * a Procurement Invoice prices each line item against the project defaults.
 * This is the one place that branch lives.
 */
export function invoiceExtendedPrices(invoice: TotalableInvoice, project: ProjectMarkupDefaults): Decimal[] {
  if (invoice.type === 'DESIGN_FEE') {
    return (invoice.designFeeCharges ?? []).map((charge) => new Decimal(charge.amount));
  }
  return (invoice.items ?? []).map((item) => priceItem(item, project).extended);
}

/** An invoice's full totals — merchandise subtotal, shipping, tax, grand total. */
export function invoiceTotals(invoice: TotalableInvoice, project: ProjectMarkupDefaults): InvoiceTotals {
  return computeInvoiceTotals({
    extendedPrices: invoiceExtendedPrices(invoice, project),
    shippingTotal: invoice.shippingTotal,
    taxRate: invoice.taxRate,
    taxBase: asTaxBase(invoice.taxBase),
  });
}

/**
 * The shared ledger roll-up behind both public summaries: what a set of
 * invoices of one type has billed, what the matching payments have covered,
 * and the difference. A voided invoice's items are detached and revert to
 * APPROVED — it never counted as real billed revenue in the first place.
 */
function summarizeLedger(
  invoices: TotalableInvoice[],
  payments: LedgerPayment[],
  project: ProjectMarkupDefaults,
  scope: { invoiceType: string; paymentCategory: string }
) {
  const live = invoices.filter((invoice) => invoice.status !== 'VOID' && invoice.type === scope.invoiceType);

  const billed = sumMoney(live.map((invoice) => invoiceTotals(invoice, project).grandTotal));
  const paid = sumMoney(
    payments.filter((payment) => payment.category === scope.paymentCategory).map((payment) => payment.amount)
  );

  return { billed, paid, outstanding: toCents(billed.minus(paid)) };
}

/**
 * Rolls a project's merchandise invoices up into invoiced / paid /
 * outstanding totals. Invoice totals are computed live from each invoice's
 * linked items (no line-item snapshotting yet — see Invoice model comment).
 * Only MERCHANDISE-category payments count here — design fee payments have
 * their own ledger (see summarizeDesignFee).
 */
export function summarizeProjectFinancials(
  project: ProjectMarkupDefaults & { invoices: TotalableInvoice[]; payments: LedgerPayment[] }
) {
  const { billed, paid, outstanding } = summarizeLedger(project.invoices, project.payments, project, {
    invoiceType: 'PROCUREMENT',
    paymentCategory: 'MERCHANDISE',
  });
  return { invoicedTotal: billed, paidTotal: paid, outstanding };
}

/**
 * Rolls up the separate design fee ledger: what's been billed toward the
 * design fee, what's been paid against it, and what's outstanding. "Billed"
 * is the grand total (including any tax/reimbursable expenses) of non-void
 * Design Fee Invoices, not the raw sum of DesignFeeCharge rows, since a
 * charge that hasn't been invoiced yet isn't billed to the client yet either.
 */
export function summarizeDesignFee(project: { invoices: TotalableInvoice[]; payments: LedgerPayment[] }) {
  // Design fee charges are billed at face value, so the markup defaults are
  // immaterial here — pass a neutral one rather than making every caller
  // thread the project's through.
  return summarizeLedger(
    project.invoices,
    project.payments,
    { defaultMarkupPct: 0, markupMode: 'MARKUP' },
    { invoiceType: 'DESIGN_FEE', paymentCategory: 'DESIGN_FEE' }
  );
}
