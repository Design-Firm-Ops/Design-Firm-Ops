import Decimal from 'decimal.js';
import { prisma } from '@/server/prisma';
import { toCents } from '@/lib/pricing';
import { invoiceTotals } from '@/lib/financials';

/**
 * Recomputes and persists an invoice's status from its current line
 * amounts (items for a Procurement Invoice, charges for a Design Fee
 * Invoice) and same-category payments. Called after any payment
 * create/update/delete that could move the invoice across a
 * paid/partially-paid boundary — status can move in either direction
 * (e.g. correcting a payment back down un-PAIDs an invoice), and never
 * touches a VOID invoice.
 */
export async function recalculateInvoiceStatus(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      project: { select: { defaultMarkupPct: true, markupMode: true } },
      items: true,
      designFeeCharges: true,
      payments: true,
    },
  });
  if (!invoice || invoice.status === 'VOID') return;

  const paymentCategory = invoice.type === 'DESIGN_FEE' ? 'DESIGN_FEE' : 'MERCHANDISE';
  const payments = invoice.payments.filter((p) => p.category === paymentCategory);

  const totals = invoiceTotals(invoice, invoice.project);

  const paid = toCents(payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0)));

  let status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID';
  if (paid.greaterThanOrEqualTo(totals.grandTotal) && totals.grandTotal.greaterThan(0)) {
    status = 'PAID';
  } else if (paid.greaterThan(0)) {
    status = 'PARTIALLY_PAID';
  } else {
    // No payments (or all reversed) — fall back to whatever the
    // non-payment-driven state was, so correcting a payment doesn't
    // strand a sent invoice back at DRAFT.
    status = invoice.issuedDate ? 'SENT' : 'DRAFT';
  }

  if (status !== invoice.status) {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
}
