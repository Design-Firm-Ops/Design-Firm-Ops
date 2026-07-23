'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeInvoiceTotals } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import Tooltip from '@/components/Tooltip';
import VoidedInvoicesDropdown from './VoidedInvoicesDropdown';

export interface DesignFeeChargeRow {
  id: string;
  description: string;
  amount: string;
  date: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

export interface DesignFeeInvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedDate: string | null;
  dueDate: string | null;
  shippingTotal: string;
  taxRate: string;
  taxBase: string;
  charges: DesignFeeChargeRow[];
}

interface CustomLine {
  description: string;
  amount: string;
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

const emptyInvoiceFields = { dueDate: '', taxRatePct: '0', taxBase: 'MERCH_ONLY', reimbursable: '0.00' };

export default function DesignFeeSection({
  projectId,
  charges,
  invoices,
}: {
  projectId: string;
  charges: DesignFeeChargeRow[];
  invoices: DesignFeeInvoiceRow[];
}) {
  const router = useRouter();

  const [showCharge, setShowCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
  const [alsoInvoice, setAlsoInvoice] = useState(false);
  const [chargeInvoiceFields, setChargeInvoiceFields] = useState(emptyInvoiceFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedChargeIds, setSelectedChargeIds] = useState<Set<string>>(new Set());
  const [customLines, setCustomLines] = useState<CustomLine[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceFields, setInvoiceFields] = useState({ ...emptyInvoiceFields, notes: '' });
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [pendingDeleteCharge, setPendingDeleteCharge] = useState<DesignFeeChargeRow | null>(null);
  const [deletingCharge, setDeletingCharge] = useState(false);

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [pendingVoid, setPendingVoid] = useState<DesignFeeInvoiceRow | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const uninvoicedCharges = charges.filter((c) => !c.invoiceId);
  const activeInvoices = invoices.filter((i) => i.status !== 'VOID');
  const voidedInvoices = invoices.filter((i) => i.status === 'VOID');

  function invoiceTotalsOf(invoice: Pick<DesignFeeInvoiceRow, 'charges' | 'shippingTotal' | 'taxRate' | 'taxBase'>) {
    return computeInvoiceTotals({
      extendedPrices: invoice.charges.map((c) => c.amount),
      shippingTotal: invoice.shippingTotal,
      taxRate: invoice.taxRate,
      taxBase: invoice.taxBase as 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING',
    });
  }

  function toggleCharge(id: string) {
    setSelectedChargeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCustomLine() {
    setCustomLines((prev) => [...prev, { description: '', amount: '' }]);
  }

  function updateCustomLine(index: number, patch: Partial<CustomLine>) {
    setCustomLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeCustomLine(index: number) {
    setCustomLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddCharge(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/design-fee-charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, ...chargeForm }),
    });

    if (!res.ok) {
      setSaving(false);
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Failed to bill the design fee.');
      return;
    }
    const charge = await res.json();

    if (alsoInvoice) {
      const invRes = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          type: 'DESIGN_FEE',
          designFeeChargeIds: [charge.id],
          dueDate: chargeInvoiceFields.dueDate,
          taxRate: chargeInvoiceFields.taxRatePct ? Number(chargeInvoiceFields.taxRatePct) / 100 : 0,
          taxBase: chargeInvoiceFields.taxBase,
          shippingTotal: chargeInvoiceFields.reimbursable || 0,
        }),
      });
      setSaving(false);

      if (!invRes.ok) {
        const data = await invRes.json().catch(() => null);
        setError(data?.error ?? 'The charge was billed, but the invoice could not be created.');
        return;
      }
    } else {
      setSaving(false);
    }

    setShowCharge(false);
    setAlsoInvoice(false);
    setChargeForm({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
    setChargeInvoiceFields(emptyInvoiceFields);
    router.refresh();
  }

  async function handleDeleteCharge() {
    if (!pendingDeleteCharge) return;
    setDeletingCharge(true);
    const res = await fetch(`/api/design-fee-charges/${pendingDeleteCharge.id}`, { method: 'DELETE' });
    setDeletingCharge(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Could not delete charge.');
      setPendingDeleteCharge(null);
      return;
    }
    setPendingDeleteCharge(null);
    router.refresh();
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setCreatingInvoice(true);
    setInvoiceError(null);

    const newDesignFeeCharges = customLines
      .filter((l) => l.description.trim() && l.amount)
      .map((l) => ({ description: l.description.trim(), amount: l.amount }));

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        type: 'DESIGN_FEE',
        designFeeChargeIds: Array.from(selectedChargeIds),
        newDesignFeeCharges,
        dueDate: invoiceFields.dueDate,
        taxRate: invoiceFields.taxRatePct ? Number(invoiceFields.taxRatePct) / 100 : 0,
        taxBase: invoiceFields.taxBase,
        shippingTotal: invoiceFields.reimbursable || 0,
        notes: invoiceFields.notes,
      }),
    });

    setCreatingInvoice(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setInvoiceError(data?.error ?? 'Failed to create invoice.');
      return;
    }

    setShowInvoiceForm(false);
    setSelectedChargeIds(new Set());
    setCustomLines([]);
    setInvoiceFields({ ...emptyInvoiceFields, notes: '' });
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

  const canSubmitInvoice =
    selectedChargeIds.size > 0 || customLines.some((l) => l.description.trim() && l.amount);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-taupe">Charges</p>
        <div className="flex gap-3 text-sm">
          <button className="text-brown hover:text-gold" onClick={() => setShowCharge(true)}>
            + Bill Design Fee
          </button>
          <button className="text-brown hover:text-gold" onClick={() => setShowInvoiceForm(true)}>
            + Create Design Fee Invoice
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      {actionError && <p className="mb-3 text-sm text-red-700">{actionError}</p>}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {charges.map((charge) => {
              const locked = !!charge.invoiceId;
              return (
                <tr key={charge.id} className={locked ? 'bg-taupe/5' : ''}>
                  <td className="px-3 py-2">{new Date(charge.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {charge.invoiceId && (
                        <Tooltip reason={`Locked to invoice ${charge.invoiceNumber}`}>
                          <span className="text-brown/40">🔒</span>
                        </Tooltip>
                      )}
                      {charge.description}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(charge.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    {locked ? (
                      <Tooltip reason="Void the invoice to remove this charge">
                        <span className="text-brown/20">✕</span>
                      </Tooltip>
                    ) : (
                      <button className="text-red-700 hover:text-red-900" onClick={() => setPendingDeleteCharge(charge)}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {charges.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-brown/50">
                  No design fee charges yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        {activeInvoices.map((invoice) => {
          const totals = invoiceTotalsOf(invoice);
          return (
            <div key={invoice.id} className="card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-base font-medium text-brown">{invoice.invoiceNumber}</h3>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase tracking-[0.1em] ${STATUS_STYLES[invoice.status] ?? 'bg-taupe/20 text-brown/70'}`}
                  >
                    {STATUS_LABELS[invoice.status] ?? invoice.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 text-right text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-brown/50">Fees</dt>
                    <dd className="tabular-nums font-medium">{formatMoney(totals.merchandiseSubtotal)}</dd>
                  </div>
                  <div>
                    <dt className="text-brown/50">Reimbursable</dt>
                    <dd className="tabular-nums font-medium">{formatMoney(totals.shippingTotal)}</dd>
                  </div>
                  <div>
                    <dt className="text-brown/50">Tax</dt>
                    <dd className="tabular-nums font-medium">{formatMoney(totals.tax)}</dd>
                  </div>
                  <div>
                    <dt className="text-brown/50">Total</dt>
                    <dd className="tabular-nums font-medium text-brown">{formatMoney(totals.grandTotal)}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-taupe/20 pt-3 text-sm">
                <a
                  className="font-medium text-gold hover:underline"
                  href={`/api/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View PDF
                </a>
                <button
                  className="font-medium text-brown hover:underline disabled:opacity-50"
                  onClick={() => handleSend(invoice.id)}
                  disabled={sendingId === invoice.id}
                >
                  {sendingId === invoice.id ? 'Sending…' : invoice.status === 'DRAFT' ? 'Send Invoice' : 'Resend Invoice'}
                </button>
                <button className="ml-auto text-red-700 hover:underline" onClick={() => setPendingVoid(invoice)}>
                  Void
                </button>
              </div>
            </div>
          );
        })}
        {activeInvoices.length === 0 && voidedInvoices.length === 0 && (
          <div className="card p-6 text-center text-brown/50">No design fee invoices yet.</div>
        )}

        <VoidedInvoicesDropdown
          invoices={voidedInvoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            total: invoiceTotalsOf(invoice).grandTotal,
          }))}
        />
      </div>

      {showCharge && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <form onSubmit={handleAddCharge} className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-medium text-brown">Bill Design Fee</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Description</label>
              <input
                className="input"
                required
                placeholder="e.g. Design fee — phase 1"
                value={chargeForm.description}
                onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                className="input"
                value={chargeForm.amount}
                onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Date</label>
              <input
                type="date"
                className="input"
                value={chargeForm.date}
                onChange={(e) => setChargeForm({ ...chargeForm, date: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-brown">
              <input type="checkbox" checked={alsoInvoice} onChange={(e) => setAlsoInvoice(e.target.checked)} />
              Also create an invoice for this now
            </label>

            {alsoInvoice && (
              <div className="grid grid-cols-2 gap-4 rounded-md border border-taupe/40 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-brown">Due Date</label>
                  <input
                    type="date"
                    className="input"
                    value={chargeInvoiceFields.dueDate}
                    onChange={(e) => setChargeInvoiceFields({ ...chargeInvoiceFields, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-brown">Sales Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={chargeInvoiceFields.taxRatePct}
                    onChange={(e) => setChargeInvoiceFields({ ...chargeInvoiceFields, taxRatePct: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-brown">Reimbursable Expenses</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={chargeInvoiceFields.reimbursable}
                    onChange={(e) => setChargeInvoiceFields({ ...chargeInvoiceFields, reimbursable: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-brown">Tax Base</label>
                  <select
                    className="input"
                    value={chargeInvoiceFields.taxBase}
                    onChange={(e) => setChargeInvoiceFields({ ...chargeInvoiceFields, taxBase: e.target.value })}
                  >
                    <option value="MERCH_ONLY">Fee only</option>
                    <option value="MERCH_PLUS_SHIPPING">Fee + reimbursable expenses</option>
                  </select>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowCharge(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : alsoInvoice ? 'Bill and Create Invoice' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showInvoiceForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <form onSubmit={handleCreateInvoice} className="card w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-medium text-brown">Create Design Fee Invoice</h2>

            {uninvoicedCharges.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-brown">Select existing charges</p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-taupe/40">
                  <table className="min-w-full text-sm">
                    <tbody className="divide-y divide-taupe/20">
                      {uninvoicedCharges.map((charge) => (
                        <tr key={charge.id}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedChargeIds.has(charge.id)}
                              onChange={() => toggleCharge(charge.id)}
                            />
                          </td>
                          <td className="px-3 py-2">{charge.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatMoney(charge.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-brown">Custom line items</p>
                <button type="button" className="text-sm text-brown hover:text-gold" onClick={addCustomLine}>
                  + Add Line
                </button>
              </div>
              {customLines.length > 0 && (
                <div className="space-y-2">
                  {customLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateCustomLine(i, { description: e.target.value })}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="input w-32"
                        placeholder="Amount"
                        value={line.amount}
                        onChange={(e) => updateCustomLine(i, { amount: e.target.value })}
                      />
                      <button type="button" className="text-red-700 hover:text-red-900" onClick={() => removeCustomLine(i)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-brown/50">Custom lines are billed to the design fee automatically when this invoice is created.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Due Date</label>
                <input
                  type="date"
                  className="input"
                  value={invoiceFields.dueDate}
                  onChange={(e) => setInvoiceFields({ ...invoiceFields, dueDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Sales Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={invoiceFields.taxRatePct}
                  onChange={(e) => setInvoiceFields({ ...invoiceFields, taxRatePct: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Reimbursable Expenses</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={invoiceFields.reimbursable}
                  onChange={(e) => setInvoiceFields({ ...invoiceFields, reimbursable: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Tax Base</label>
                <select
                  className="input"
                  value={invoiceFields.taxBase}
                  onChange={(e) => setInvoiceFields({ ...invoiceFields, taxBase: e.target.value })}
                >
                  <option value="MERCH_ONLY">Fee only</option>
                  <option value="MERCH_PLUS_SHIPPING">Fee + reimbursable expenses</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
              <textarea
                className="input"
                rows={2}
                value={invoiceFields.notes}
                onChange={(e) => setInvoiceFields({ ...invoiceFields, notes: e.target.value })}
              />
            </div>

            {invoiceError && <p className="text-sm text-red-700">{invoiceError}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowInvoiceForm(false)}>
                Cancel
              </button>
              <Tooltip reason={!canSubmitInvoice ? 'Select a charge or add a custom line first' : undefined}>
                <button type="submit" className="btn-primary" disabled={creatingInvoice || !canSubmitInvoice}>
                  {creatingInvoice ? 'Creating…' : 'Create Invoice'}
                </button>
              </Tooltip>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDeleteCharge}
        title="Delete charge?"
        message={`This will permanently delete "${pendingDeleteCharge?.description}". This cannot be undone.`}
        busy={deletingCharge}
        onConfirm={handleDeleteCharge}
        onCancel={() => setPendingDeleteCharge(null)}
      />

      <ConfirmDialog
        open={!!pendingVoid}
        title="Void this invoice?"
        message={`"${pendingVoid?.invoiceNumber}" will be marked void and its ${pendingVoid?.charges.length ?? 0} charge(s) will unlock, available to re-invoice. This cannot be undone, but the invoice stays in the project's history.`}
        confirmLabel="Void Invoice"
        busy={voiding}
        onConfirm={handleVoid}
        onCancel={() => setPendingVoid(null)}
      />
    </div>
  );
}
