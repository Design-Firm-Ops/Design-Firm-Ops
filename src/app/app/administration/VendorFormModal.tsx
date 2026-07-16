'use client';

import { useState } from 'react';

export interface VendorRow {
  id: string;
  name: string;
  website: string | null;
  showroomRep: string | null;
  accountType: string | null;
  productType: string | null;
  priceRange: string | null;
  offerings: string[];
  notes: string | null;
  accountNumber: string | null;
  tradeAccountUsername: string | null;
  tradeAccountNotes: string | null;
  hasTradeAccountPassword: boolean;
}

const OFFERINGS = ['FURNITURE', 'OUTDOOR', 'RUGS', 'PILLOWS', 'DECOR', 'MIRRORS', 'LAMPS', 'BEDDING'];

export default function VendorFormModal({
  vendor,
  canViewCredentials,
  onClose,
  onSaved,
}: {
  vendor: VendorRow | null;
  canViewCredentials: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: vendor?.name ?? '',
    website: vendor?.website ?? '',
    showroomRep: vendor?.showroomRep ?? '',
    accountType: vendor?.accountType ?? '',
    productType: vendor?.productType ?? '',
    priceRange: vendor?.priceRange ?? '',
    offerings: vendor?.offerings ?? [],
    notes: vendor?.notes ?? '',
    accountNumber: vendor?.accountNumber ?? '',
    tradeAccountUsername: vendor?.tradeAccountUsername ?? '',
    tradeAccountPassword: '',
    tradeAccountNotes: vendor?.tradeAccountNotes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleOffering(offering: string) {
    setForm((prev) => ({
      ...prev,
      offerings: prev.offerings.includes(offering)
        ? prev.offerings.filter((o) => o !== offering)
        : [...prev.offerings, offering],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(vendor ? `/api/vendors/${vendor.id}` : '/api/vendors', {
      method: vendor ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <form onSubmit={handleSubmit} className="card w-full max-w-2xl space-y-4 p-6">
        <h2 className="text-lg font-semibold text-brown">{vendor ? 'Edit Vendor' : 'New Vendor'}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-brown">Vendor Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-brown">Website</label>
            <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-brown">Showroom / Rep</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Showroom name, rep name, email, phone"
              value={form.showroomRep}
              onChange={(e) => setForm({ ...form, showroomRep: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Trade or Retail</label>
            <select className="input" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
              <option value="">—</option>
              <option value="TRADE">Trade</option>
              <option value="RETAIL">Retail</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Stock or Custom</label>
            <select className="input" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
              <option value="">—</option>
              <option value="STOCK">Stock</option>
              <option value="CUSTOM">Custom</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Price Range</label>
            <select className="input" value={form.priceRange} onChange={(e) => setForm({ ...form, priceRange: e.target.value })}>
              <option value="">—</option>
              <option value="LOW">Low</option>
              <option value="MID">Mid</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Account Number</label>
            <input
              className="input"
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-2 block text-sm font-medium text-brown">Primary Offerings</label>
            <div className="flex flex-wrap gap-3">
              {OFFERINGS.map((o) => (
                <label key={o} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form.offerings.includes(o)} onChange={() => toggleOffering(o)} />
                  {o.charAt(0) + o.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        {canViewCredentials && (
          <div className="space-y-3 rounded-md border border-taupe/40 p-4">
            <h3 className="text-sm font-semibold text-brown">Trade Account Credentials</h3>
            <p className="text-xs text-brown/50">Stored encrypted. Leave password blank to keep it unchanged.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Username</label>
                <input
                  className="input"
                  value={form.tradeAccountUsername}
                  onChange={(e) => setForm({ ...form, tradeAccountUsername: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder={vendor?.hasTradeAccountPassword ? '••••••••' : ''}
                  value={form.tradeAccountPassword}
                  onChange={(e) => setForm({ ...form, tradeAccountPassword: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. no login, quotes through rep; or application pending"
                  value={form.tradeAccountNotes}
                  onChange={(e) => setForm({ ...form, tradeAccountNotes: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

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
