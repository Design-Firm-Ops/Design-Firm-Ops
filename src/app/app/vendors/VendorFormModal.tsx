'use client';

import { useState } from 'react';
import type { OfferingRow } from './OfferingManager';
import { apiError, apiSend } from '@/lib/apiClient';
import Modal from '@/components/Modal';

export interface VendorRow {
  id: string;
  name: string;
  website: string | null;
  repName: string | null;
  repEmail: string | null;
  repPhone: string | null;
  showroomName: string | null;
  showroomAddress: string | null;
  accountType: string | null;
  productType: string | null;
  priceRange: string | null;
  offerings: OfferingRow[];
  notes: string | null;
  accountNumber: string | null;
  tradeAccountUsername: string | null;
  tradeAccountNotes: string | null;
  hasTradeAccountPassword: boolean;
}

export default function VendorFormModal({
  vendor,
  offeringOptions,
  canViewCredentials,
  onClose,
  onSaved,
}: {
  vendor: VendorRow | null;
  offeringOptions: OfferingRow[];
  canViewCredentials: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: vendor?.name ?? '',
    website: vendor?.website ?? '',
    repName: vendor?.repName ?? '',
    repEmail: vendor?.repEmail ?? '',
    repPhone: vendor?.repPhone ?? '',
    showroomName: vendor?.showroomName ?? '',
    showroomAddress: vendor?.showroomAddress ?? '',
    accountType: vendor?.accountType ?? '',
    productType: vendor?.productType ?? '',
    priceRange: vendor?.priceRange ?? '',
    offerings: vendor?.offerings.map((o) => o.id) ?? [],
    notes: vendor?.notes ?? '',
    accountNumber: vendor?.accountNumber ?? '',
    tradeAccountUsername: vendor?.tradeAccountUsername ?? '',
    tradeAccountPassword: '',
    tradeAccountNotes: vendor?.tradeAccountNotes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleOffering(offeringId: string) {
    setForm((prev) => ({
      ...prev,
      offerings: prev.offerings.includes(offeringId)
        ? prev.offerings.filter((o) => o !== offeringId)
        : [...prev.offerings, offeringId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await apiSend(vendor ? `/api/vendors/${vendor.id}` : '/api/vendors', vendor ? 'PATCH' : 'POST', form);

    setSaving(false);

    if (!res.ok) {
      setError(await apiError(res, 'Something went wrong.'));
      return;
    }

    onSaved();
  }

  return (
    <Modal width="2xl" scrollable onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-medium text-brown">{vendor ? 'Edit Vendor' : 'New Vendor'}</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-brown">Vendor Name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-brown">Website</label>
          <input
            className="input"
            placeholder="https://…"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-taupe/40 p-4">
        <h3 className="text-sm font-medium text-brown">Rep Information</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-brown">Name</label>
            <input className="input" value={form.repName} onChange={(e) => setForm({ ...form, repName: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brown">Email</label>
            <input
              type="email"
              className="input"
              value={form.repEmail}
              onChange={(e) => setForm({ ...form, repEmail: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brown">Phone</label>
            <input className="input" value={form.repPhone} onChange={(e) => setForm({ ...form, repPhone: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-taupe/40 p-4">
        <h3 className="text-sm font-medium text-brown">Showroom Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-brown">Showroom Name</label>
            <input
              className="input"
              value={form.showroomName}
              onChange={(e) => setForm({ ...form, showroomName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brown">Address</label>
            <input
              className="input"
              value={form.showroomAddress}
              onChange={(e) => setForm({ ...form, showroomAddress: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
            {offeringOptions.map((o) => (
              <label key={o.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={form.offerings.includes(o.id)} onChange={() => toggleOffering(o.id)} />
                {o.name}
              </label>
            ))}
            {offeringOptions.length === 0 && <p className="text-xs text-brown/50">No categories yet — add some from the Vendors page.</p>}
          </div>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      {canViewCredentials && (
        <div className="space-y-3 rounded-md border border-taupe/40 p-4">
          <h3 className="text-sm font-medium text-brown">Trade Account Credentials</h3>
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
    </Modal>
  );
}
