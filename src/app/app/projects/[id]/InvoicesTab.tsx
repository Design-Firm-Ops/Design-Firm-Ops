'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeInvoiceTotals, priceLine } from '@/lib/pricing';
import { formatMoney, formatPercentFromFraction } from '@/lib/money';
import type { ItemRow } from './ItemsTable';

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  shippingTotal: string;
  taxRate: string;
  taxBase: string;
  issuedDate: string | null;
  dueDate: string | null;
  items: ItemRow[];
}

export default function InvoicesTab({
  projectId,
  invoices,
  uninvoicedItems,
  projectDefaultMarkupPct,
  projectMarkupMode,
  defaultTaxRate,
  defaultTaxBase,
}: {
  projectId: string;
  invoices: InvoiceRow[];
  uninvoicedItems: ItemRow[];
  projectDefaultMarkupPct: string;
  projectMarkupMode: string;
  defaultTaxRate: string;
  defaultTaxBase: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shippingTotal, setShippingTotal] = useState('0.00');
  const [taxRate, setTaxRate] = useState(defaultTaxRate);
  const [taxBase, setTaxBase] = useState(defaultTaxBase);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function priceOf(item: ItemRow) {
    return priceLine({
      unitCost: item.unitCost,
      platformFee: item.platformFee,
      qty: item.qty,
      markupPct: item.markupPct,
      markupMode: item.markupMode as 'MARKUP' | 'MARGIN' | null,
      projectDefaultMarkupPct,
      projectMarkupMode: projectMarkupMode as 'MARKUP' | 'MARGIN',
    });
  }

  const preview = useMemo(() => {
    const extendedPrices = uninvoicedItems
      .filter((i) => selectedIds.has(i.id))
      .map((i) => priceOf(i).extended);
    if (extendedPrices.length === 0) return null;
    return computeInvoiceTotals({
      extendedPrices,
      shippingTotal: shippingTotal || 0,
      taxRate: taxRate || 0,
      taxBase: taxBase as 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, shippingTotal, taxRate, taxBase, uninvoicedItems]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        itemIds: Array.from(selectedIds),
        shippingTotal,
        taxRate,
        taxBase,
        dueDate,
        notes,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Failed to create invoice.');
      return;
    }

    setShowForm(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          className="btn-primary"
          onClick={() => setShowForm(true)}
          disabled={uninvoicedItems.length === 0}
          title={uninvoicedItems.length === 0 ? 'No approved, un-invoiced items available' : undefined}
        >
          + Create Invoice
        </button>
      </div>

      <div className="space-y-4">
        {invoices.map((invoice) => {
          const extendedPrices = invoice.items.map((i) => priceOf(i).extended);
          const totals = computeInvoiceTotals({
            extendedPrices,
            shippingTotal: invoice.shippingTotal,
            taxRate: invoice.taxRate,
            taxBase: invoice.taxBase as 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING',
          });
          return (
            <div key={invoice.id} className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-medium text-brown">{invoice.invoiceNumber}</h3>
                  <p className="text-xs uppercase tracking-[0.24em] text-taupe">{invoice.status}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-brown/60">
                    {invoice.items.length} item{invoice.items.length === 1 ? '' : 's'} · tax {formatPercentFromFraction(invoice.taxRate)} on{' '}
                    {invoice.taxBase === 'MERCH_PLUS_SHIPPING' ? 'merch + shipping' : 'merch only'}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-brown/50">Merchandise</dt>
                  <dd className="tabular-nums font-medium">{formatMoney(totals.merchandiseSubtotal)}</dd>
                </div>
                <div>
                  <dt className="text-brown/50">Shipping</dt>
                  <dd className="tabular-nums font-medium">{formatMoney(totals.shippingTotal)}</dd>
                </div>
                <div>
                  <dt className="text-brown/50">Tax</dt>
                  <dd className="tabular-nums font-medium">{formatMoney(totals.tax)}</dd>
                </div>
                <div>
                  <dt className="text-brown/50">Grand Total</dt>
                  <dd className="tabular-nums font-medium text-brown">{formatMoney(totals.grandTotal)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
        {invoices.length === 0 && (
          <div className="card p-8 text-center text-brown/50">No invoices yet.</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <form onSubmit={handleCreate} className="card w-full max-w-2xl space-y-4 p-6">
            <h2 className="text-lg font-medium text-brown">Create Invoice</h2>

            <div>
              <p className="mb-2 text-sm font-medium text-brown">Select items to invoice</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-taupe/40">
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-taupe/20">
                    {uninvoicedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} />
                        </td>
                        <td className="px-3 py-2">{item.tag}</td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(priceOf(item).extended)}</td>
                      </tr>
                    ))}
                    {uninvoicedItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-brown/50">
                          No approved items available to invoice.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Shipping / Freight</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={shippingTotal}
                  onChange={(e) => setShippingTotal(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Tax Rate (e.g. 0.07)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Tax Base</label>
                <select className="input" value={taxBase} onChange={(e) => setTaxBase(e.target.value)}>
                  <option value="MERCH_ONLY">Merchandise only</option>
                  <option value="MERCH_PLUS_SHIPPING">Merchandise + shipping</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Due Date</label>
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {preview && (
              <div className="rounded-md border border-gold/40 bg-gold/10 p-4 text-sm">
                <p className="mb-2 font-medium text-brown">Preview</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <p className="text-brown/50">Merchandise</p>
                    <p className="tabular-nums font-medium">{formatMoney(preview.merchandiseSubtotal)}</p>
                  </div>
                  <div>
                    <p className="text-brown/50">Shipping</p>
                    <p className="tabular-nums font-medium">{formatMoney(preview.shippingTotal)}</p>
                  </div>
                  <div>
                    <p className="text-brown/50">Tax</p>
                    <p className="tabular-nums font-medium">{formatMoney(preview.tax)}</p>
                  </div>
                  <div>
                    <p className="text-brown/50">Grand Total</p>
                    <p className="tabular-nums font-medium">{formatMoney(preview.grandTotal)}</p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving || selectedIds.size === 0}>
                {saving ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
