'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { formatMoney } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import Tooltip from '@/components/Tooltip';

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
  charges: DesignFeeChargeRow[];
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

export default function DesignFeeSection({
  projectId,
  summary,
  charges,
  invoices,
}: {
  projectId: string;
  summary: { billed: Decimal.Value; paid: Decimal.Value; outstanding: Decimal.Value };
  charges: DesignFeeChargeRow[];
  invoices: DesignFeeInvoiceRow[];
}) {
  const router = useRouter();
  const [showCharge, setShowCharge] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'ACH' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedChargeIds, setSelectedChargeIds] = useState<Set<string>>(new Set());
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [pendingDeleteCharge, setPendingDeleteCharge] = useState<DesignFeeChargeRow | null>(null);
  const [deletingCharge, setDeletingCharge] = useState(false);

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [pendingVoid, setPendingVoid] = useState<DesignFeeInvoiceRow | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const uninvoicedCharges = charges.filter((c) => !c.invoiceId);

  function toggleCharge(id: string) {
    setSelectedChargeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Failed to add charge.');
      return;
    }
    setShowCharge(false);
    setChargeForm({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
    router.refresh();
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, category: 'DESIGN_FEE', ...paymentForm }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Failed to log payment.');
      return;
    }
    setShowPayment(false);
    setPaymentForm({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'ACH' });
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

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        type: 'DESIGN_FEE',
        designFeeChargeIds: Array.from(selectedChargeIds),
        dueDate,
        notes: invoiceNotes,
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
    setDueDate('');
    setInvoiceNotes('');
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

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-taupe">Design Fee</p>
        <div className="flex gap-3 text-sm">
          <button className="text-brown hover:text-gold" onClick={() => setShowCharge(true)}>
            + Bill Design Fee
          </button>
          <button className="text-brown hover:text-gold" onClick={() => setShowPayment(true)}>
            + Log Payment
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-brown/50">Billed</dt>
          <dd className="tabular-nums font-medium">{formatMoney(summary.billed)}</dd>
        </div>
        <div>
          <dt className="text-brown/50">Paid</dt>
          <dd className="tabular-nums font-medium">{formatMoney(summary.paid)}</dd>
        </div>
        <div>
          <dt className="text-brown/50">Outstanding</dt>
          <dd className="tabular-nums font-medium text-brown">{formatMoney(summary.outstanding)}</dd>
        </div>
      </dl>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {actionError && <p className="mt-3 text-sm text-red-700">{actionError}</p>}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-taupe">Charges</p>
          <Tooltip reason={uninvoicedCharges.length === 0 ? 'No un-invoiced charges available' : undefined}>
            <button
              className="text-sm text-brown hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
              disabled={uninvoicedCharges.length === 0}
              onClick={() => setShowInvoiceForm(true)}
            >
              + Create Design Fee Invoice
            </button>
          </Tooltip>
        </div>

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
                      {uninvoicedCharges.some((c) => c.id === charge.id) && (
                        <input
                          type="checkbox"
                          className="ml-3"
                          checked={selectedChargeIds.has(charge.id)}
                          onChange={() => toggleCharge(charge.id)}
                        />
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
      </div>

      {invoices.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Design Fee Invoices</p>
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const total = invoice.charges.reduce((sum, c) => sum.plus(c.amount), new Decimal(0));
              const isVoid = invoice.status === 'VOID';
              return (
                <div key={invoice.id} className={`card p-4 ${isVoid ? 'opacity-60' : ''}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className={`font-serif text-base font-medium text-brown ${isVoid ? 'line-through' : ''}`}>
                        {invoice.invoiceNumber}
                      </h3>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase tracking-[0.1em] ${STATUS_STYLES[invoice.status] ?? 'bg-taupe/20 text-brown/70'}`}
                      >
                        {STATUS_LABELS[invoice.status] ?? invoice.status}
                      </span>
                    </div>
                    <p className="tabular-nums text-sm font-medium text-brown">{formatMoney(total)}</p>
                  </div>

                  {!isVoid && (
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCharge && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
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
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowCharge(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPayment && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleAddPayment} className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-medium text-brown">Log Design Fee Payment</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                className="input"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Date</label>
              <input
                type="date"
                className="input"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Method</label>
              <select
                className="input"
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
              >
                {['ACH', 'WIRE', 'CHECK', 'CREDIT_CARD', 'OTHER'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowPayment(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showInvoiceForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <form onSubmit={handleCreateInvoice} className="card w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-medium text-brown">Create Design Fee Invoice</h2>

            <div>
              <p className="mb-2 text-sm font-medium text-brown">Select charges to invoice</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-taupe/40">
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
                    {uninvoicedCharges.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-brown/50">
                          No un-invoiced charges available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Due Date</label>
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
              <textarea
                className="input"
                rows={2}
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
              />
            </div>

            {invoiceError && <p className="text-sm text-red-700">{invoiceError}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowInvoiceForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creatingInvoice || selectedChargeIds.size === 0}>
                {creatingInvoice ? 'Creating…' : 'Create Invoice'}
              </button>
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
