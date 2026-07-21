'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeInvoiceTotals, priceLine } from '@/lib/pricing';
import { formatMoney, formatPercentFromFraction } from '@/lib/money';
import { COLUMN_LABELS, COLUMN_PRESETS, INVOICE_COLUMNS, InvoiceColumnKey, resolveColumnConfig } from '@/lib/invoiceColumns';
import ConfirmDialog from '@/components/ConfirmDialog';
import Tooltip from '@/components/Tooltip';
import VoidedInvoicesDropdown from './VoidedInvoicesDropdown';
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
  columnConfig: { columns: string[] } | null;
  items: ItemRow[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-taupe/20 text-brown/70',
  SENT: 'bg-gold/20 text-brown',
  PARTIALLY_PAID: 'bg-gold/40 text-brown',
  PAID: 'bg-green-50 text-green-800',
  VOID: 'bg-taupe/10 text-brown/40',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  VOID: 'Void',
};

export default function InvoicesTab({
  projectId,
  invoices,
  uninvoicedItems,
  projectDefaultMarkupPct,
  projectMarkupMode,
  defaultTaxRate,
  defaultTaxBase,
  projectDefaultColumnConfig,
}: {
  projectId: string;
  invoices: InvoiceRow[];
  uninvoicedItems: ItemRow[];
  projectDefaultMarkupPct: string;
  projectMarkupMode: string;
  defaultTaxRate: string;
  defaultTaxBase: string;
  projectDefaultColumnConfig?: { columns: string[] } | null;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shippingTotal, setShippingTotal] = useState('0.00');
  // Entered as a percentage (e.g. "7" = 7%) — converted to/from the stored fraction.
  const [taxRatePct, setTaxRatePct] = useState(String(Number(defaultTaxRate) * 100));
  const [taxBase, setTaxBase] = useState(defaultTaxBase);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedColumnsId, setExpandedColumnsId] = useState<string | null>(null);
  const [savingColumnsId, setSavingColumnsId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingVoid, setPendingVoid] = useState<InvoiceRow | null>(null);
  const [voiding, setVoiding] = useState(false);

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
      taxRate: taxRatePct ? Number(taxRatePct) / 100 : 0,
      taxBase: taxBase as 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, shippingTotal, taxRatePct, taxBase, uninvoicedItems]);

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
        type: 'PROCUREMENT',
        itemIds: Array.from(selectedIds),
        shippingTotal,
        taxRate: taxRatePct ? Number(taxRatePct) / 100 : 0,
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

  async function handleSaveColumns(invoiceId: string, columns: InvoiceColumnKey[]) {
    setSavingColumnsId(invoiceId);
    setActionError(null);

    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnConfig: { columns } }),
    });

    setSavingColumnsId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ? JSON.stringify(data.error) : 'Could not save column selection.');
      return;
    }

    router.refresh();
  }

  async function handleSend(invoiceId: string) {
    setSendingId(invoiceId);
    setActionError(null);

    const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' });

    setSendingId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? 'Could not send invoice.');
      return;
    }

    router.refresh();
  }

  async function handleVoid() {
    if (!pendingVoid) return;
    setVoiding(true);
    setActionError(null);

    const res = await fetch(`/api/invoices/${pendingVoid.id}/void`, { method: 'POST' });

    setVoiding(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setActionError(data?.error ?? 'Could not void invoice.');
      setPendingVoid(null);
      return;
    }

    setPendingVoid(null);
    router.refresh();
  }

  const activeInvoices = invoices.filter((i) => i.status !== 'VOID');
  const voidedInvoices = invoices.filter((i) => i.status === 'VOID');

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Tooltip reason={uninvoicedItems.length === 0 ? 'No approved, un-invoiced items available' : undefined}>
          <button className="btn-primary" onClick={() => setShowForm(true)} disabled={uninvoicedItems.length === 0}>
            + Create Invoice
          </button>
        </Tooltip>
      </div>

      {actionError && <p className="mb-3 text-sm text-red-700">{actionError}</p>}

      <div className="space-y-4">
        {activeInvoices.map((invoice) => {
          const extendedPrices = invoice.items.map((i) => priceOf(i).extended);
          const totals = computeInvoiceTotals({
            extendedPrices,
            shippingTotal: invoice.shippingTotal,
            taxRate: invoice.taxRate,
            taxBase: invoice.taxBase as 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING',
          });
          const resolved = resolveColumnConfig(invoice.columnConfig, projectDefaultColumnConfig);
          const columnsOpen = expandedColumnsId === invoice.id;

          return (
            <div key={invoice.id} className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-medium text-brown">{invoice.invoiceNumber}</h3>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase tracking-[0.1em] ${STATUS_STYLES[invoice.status] ?? 'bg-taupe/20 text-brown/70'}`}
                  >
                    {STATUS_LABELS[invoice.status] ?? invoice.status}
                  </span>
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

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-taupe/20 pt-3">
                <a
                  className="text-sm font-medium text-gold hover:underline"
                  href={`/api/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View PDF
                </a>
                <button
                  className="text-sm font-medium text-brown hover:underline"
                  onClick={() => setExpandedColumnsId(columnsOpen ? null : invoice.id)}
                >
                  {columnsOpen ? 'Hide columns' : 'Client-visible columns'}
                </button>
                <button
                  className="text-sm font-medium text-brown hover:underline disabled:opacity-50"
                  onClick={() => handleSend(invoice.id)}
                  disabled={sendingId === invoice.id}
                >
                  {sendingId === invoice.id ? 'Sending…' : invoice.status === 'DRAFT' ? 'Send Invoice' : 'Resend Invoice'}
                </button>
                <button className="ml-auto text-sm text-red-700 hover:underline" onClick={() => setPendingVoid(invoice)}>
                  Void
                </button>
              </div>

              {columnsOpen && (
                <div className="mt-3 rounded-md border border-taupe/40 bg-cream/60 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.24em] text-taupe">Presets</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        className="rounded-full border border-taupe/50 px-3 py-1 text-xs text-brown hover:border-gold"
                        onClick={() => handleSaveColumns(invoice.id, preset.config.columns)}
                        disabled={savingColumnsId === invoice.id}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 text-xs uppercase tracking-[0.24em] text-taupe">Columns shown to client</p>
                  <div className="flex flex-wrap gap-3">
                    {INVOICE_COLUMNS.map((col) => (
                      <label key={col} className="flex items-center gap-1.5 text-sm text-brown">
                        <input
                          type="checkbox"
                          checked={resolved.columns.includes(col)}
                          disabled={savingColumnsId === invoice.id}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...resolved.columns, col]
                              : resolved.columns.filter((c) => c !== col);
                            handleSaveColumns(
                              invoice.id,
                              INVOICE_COLUMNS.filter((c) => next.includes(c))
                            );
                          }}
                        />
                        {COLUMN_LABELS[col]}
                      </label>
                    ))}
                  </div>
                  {savingColumnsId === invoice.id && <p className="mt-2 text-xs text-brown/50">Saving…</p>}
                </div>
              )}
            </div>
          );
        })}
        {activeInvoices.length === 0 && (
          <div className="card p-8 text-center text-brown/50">No invoices yet.</div>
        )}

        <VoidedInvoicesDropdown
          invoices={voidedInvoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            total: computeInvoiceTotals({
              extendedPrices: invoice.items.map((i) => priceOf(i).extended),
              shippingTotal: invoice.shippingTotal,
              taxRate: invoice.taxRate,
              taxBase: invoice.taxBase as 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING',
            }).grandTotal,
          }))}
        />
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
                <label className="mb-1 block text-sm font-medium text-brown">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(e.target.value)}
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

      <ConfirmDialog
        open={!!pendingVoid}
        title="Void this invoice?"
        message={`"${pendingVoid?.invoiceNumber}" will be marked void and its ${pendingVoid?.items.length ?? 0} item(s) will unlock and return to Approved status, available to re-invoice. This cannot be undone, but the invoice stays in the project's history.`}
        confirmLabel="Void Invoice"
        busy={voiding}
        onConfirm={handleVoid}
        onCancel={() => setPendingVoid(null)}
      />
    </div>
  );
}
