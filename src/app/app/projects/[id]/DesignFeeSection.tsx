'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { formatMoney } from '@/lib/money';

export default function DesignFeeSection({
  projectId,
  summary,
}: {
  projectId: string;
  summary: { billed: Decimal.Value; paid: Decimal.Value; outstanding: Decimal.Value };
}) {
  const router = useRouter();
  const [showCharge, setShowCharge] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), method: 'ACH' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
