'use client';

import { useState } from 'react';
import { priceLine } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import ItemDocumentsSection from './ItemDocumentsSection';
import ItemCustomFields, { ItemFieldDefRow } from './ItemCustomFields';
import type { ItemRow } from './ItemsTable';

export type { ItemFieldDefRow };

interface VendorOption {
  id: string;
  name: string;
}

interface OfferingOption {
  id: string;
  name: string;
}

export default function ItemDetailModal({
  item,
  projectId,
  vendors,
  offeringOptions,
  fieldDefs,
  isAdmin,
  projectDefaultMarkupPct,
  projectMarkupMode,
  onClose,
  onSaved,
}: {
  item: ItemRow;
  projectId: string;
  vendors: VendorOption[];
  offeringOptions: OfferingOption[];
  fieldDefs: ItemFieldDefRow[];
  isAdmin: boolean;
  projectDefaultMarkupPct: string;
  projectMarkupMode: string;
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
    vendorId: item.vendorId ?? '',
    offeringId: item.offeringId ?? '',
    qty: item.qty,
    unitCost: item.unitCost,
    markupPct: item.markupPct ?? '',
    markupMode: item.markupMode ?? '',
  });
  const [imageUrl, setImageUrl] = useState(item.imageUrl);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [defs, setDefs] = useState(fieldDefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!item.invoiceId;

  const priced = priceLine({
    unitCost: form.unitCost,
    platformFee: form.platformFee,
    qty: form.qty,
    markupPct: form.markupPct === '' ? null : form.markupPct,
    markupMode: (form.markupMode || null) as 'MARKUP' | 'MARGIN' | null,
    projectDefaultMarkupPct,
    projectMarkupMode: projectMarkupMode as 'MARKUP' | 'MARGIN',
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);

    const body = new FormData();
    body.append('file', file);

    const res = await fetch(`/api/items/${item.id}/image`, { method: 'POST', body });
    setUploadingImage(false);
    e.target.value = '';

    if (res.ok) {
      const data = await res.json();
      setImageUrl(data.imageUrl ?? null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      markupPct: form.markupPct === '' ? null : Number(form.markupPct),
      markupMode: form.markupMode || null,
    };

    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    onSaved({ id: item.id, ...form, markupPct: payload.markupPct === null ? null : String(payload.markupPct) });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-2xl max-h-[90vh] space-y-4 overflow-y-auto p-6">
        <h2 className="text-lg font-medium text-brown">Item Details — {item.tag}</h2>

        {locked && (
          <p className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-brown">
            🔒 Locked to invoice {item.invoiceNumber}. Use "Correct this item" in the Procurement list to edit.
          </p>
        )}

        <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => imageUrl && setEnlarged(true)}>
            {imageUrl ? (
              <img src={imageUrl} alt={form.name} className="h-24 w-24 rounded object-cover" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded bg-taupe/20 text-xs text-brown/40">
                No image
              </span>
            )}
          </button>
          <div>
            <label className="btn-secondary cursor-pointer text-xs">
              {uploadingImage ? 'Uploading…' : imageUrl ? 'Replace Image' : 'Upload Image'}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>
        </div>

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

        <div className="rounded-md border border-taupe/40 p-4">
          <h3 className="mb-3 text-sm font-medium text-brown">Cost & Pricing</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Qty</label>
              <input
                type="number"
                min={1}
                className="input"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Unit Cost</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Markup %</label>
              <input
                type="number"
                step="0.001"
                placeholder={`${projectDefaultMarkupPct} (default)`}
                className="input"
                value={form.markupPct}
                onChange={(e) => setForm({ ...form, markupPct: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Markup Mode</label>
              <select className="input" value={form.markupMode} onChange={(e) => setForm({ ...form, markupMode: e.target.value })}>
                <option value="">Project default</option>
                <option value="MARKUP">Markup %</option>
                <option value="MARGIN">Margin %</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-sm text-brown/70">
            Client price: <span className="font-medium text-brown">{formatMoney(priced.unitPrice)}</span> · Extended:{' '}
            <span className="font-medium text-brown">{formatMoney(priced.extended)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Vendor</label>
            <select className="input" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Offering Type</label>
            <select className="input" value={form.offeringId} onChange={(e) => setForm({ ...form, offeringId: e.target.value })}>
              <option value="">—</option>
              {offeringOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
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
        </fieldset>

        <ItemCustomFields
          itemId={item.id}
          fieldDefs={defs}
          initialValues={Object.fromEntries(item.fieldValues.map((v) => [v.fieldDefId, v.value ?? '']))}
          isAdmin={isAdmin}
          onDefsChanged={setDefs}
        />

        <ItemDocumentsSection itemId={item.id} projectId={projectId} />

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!locked && (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>

      {enlarged && imageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8" onClick={() => setEnlarged(false)}>
          <img src={imageUrl} alt={form.name} className="max-h-full max-w-full rounded" />
        </div>
      )}
    </div>
  );
}
