'use client';

import { useState } from 'react';
import type { ItemRow } from './ItemsTable';

export default function ItemDetailModal({
  item,
  onClose,
  onSaved,
}: {
  item: ItemRow;
  onClose: () => void;
  onSaved: (updated: Partial<ItemRow> & { id: string }) => void;
}) {
  const [form, setForm] = useState({
    name: item.name,
    invoiceDisplayName: item.invoiceDisplayName ?? '',
    dimensions: item.dimensions ?? '',
    finish: item.finish ?? '',
    link: item.link ?? '',
    shippingNotes: item.shippingNotes ?? '',
    platformFee: item.platformFee,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    onSaved({ id: item.id, ...form });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg space-y-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-brown">Item Details — {item.tag}</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Invoice Display Name (optional override)</label>
          <input
            className="input"
            placeholder="Shown to client instead of Name, if set"
            value={form.invoiceDisplayName}
            onChange={(e) => setForm({ ...form, invoiceDisplayName: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Dimensions</label>
            <input
              className="input"
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Finish</label>
            <input className="input" value={form.finish} onChange={(e) => setForm({ ...form, finish: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Link</label>
          <input className="input" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Platform Fee (per unit)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.platformFee}
            onChange={(e) => setForm({ ...form, platformFee: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Shipping Notes</label>
          <textarea
            className="input"
            rows={2}
            value={form.shippingNotes}
            onChange={(e) => setForm({ ...form, shippingNotes: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
