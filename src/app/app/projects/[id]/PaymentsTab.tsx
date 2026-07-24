'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, sumMoney } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import { apiError, apiSend } from '@/lib/apiClient';
import { formatDate } from '@/lib/format';
import Modal from '@/components/Modal';

export interface PaymentRow {
  id: string;
  amount: string;
  date: string;
  method: string;
  reference: string | null;
  notes: string | null;
  invoiceId: string | null;
}

const METHODS = ['ACH', 'WIRE', 'CHECK', 'CREDIT_CARD', 'OTHER'];

export default function PaymentsTab({
  projectId,
  category,
  title,
  payments,
  invoiceOptions,
}: {
  projectId: string;
  category: 'MERCHANDISE' | 'DESIGN_FEE';
  title: string;
  payments: PaymentRow[];
  invoiceOptions: { id: string; invoiceNumber: string }[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    invoiceId: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    method: 'ACH',
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await apiSend('/api/payments', 'POST', { ...form, projectId, category });

    setSaving(false);

    if (!res.ok) {
      setError(await apiError(res, 'Something went wrong.'));
      return;
    }

    setShowForm(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    await apiSend(`/api/payments/${pendingDelete.id}`, 'DELETE');
    setDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }

  const total = sumMoney(payments.map((p) => p.amount));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-brown">{title}</h2>
          <p className="text-sm text-brown/60">Total received: {formatMoney(total)}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Log Payment
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3">{formatDate(p.date)}</td>
                <td className="px-4 py-3 tabular-nums font-medium">{formatMoney(p.amount)}</td>
                <td className="px-4 py-3">{p.method}</td>
                <td className="px-4 py-3">{p.reference || '—'}</td>
                <td className="px-4 py-3">
                  {invoiceOptions.find((i) => i.id === p.invoiceId)?.invoiceNumber ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-sm text-red-700 hover:text-red-900" onClick={() => setPendingDelete(p)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brown/50">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal width="md" onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-lg font-medium text-brown">Log Payment</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Amount</label>
            <input
              type="number"
              step="0.01"
              required
              className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Date</label>
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Method</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Invoice (optional)</label>
            <select
              className="input"
              value={form.invoiceId}
              onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
            >
              <option value="">—</option>
              {invoiceOptions.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Reference</label>
            <input
              className="input"
              placeholder="check #, transfer id, etc."
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete payment?"
        message="This will permanently remove this payment record. This cannot be undone."
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
