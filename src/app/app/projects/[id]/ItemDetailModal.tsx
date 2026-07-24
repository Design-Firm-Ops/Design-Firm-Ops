'use client';

import { useState } from 'react';
import { priceItem } from '@/lib/financials';
import { formatMoney } from '@/lib/money';
import AttachedDocuments from '@/components/AttachedDocuments';
import ItemCustomFields, { ItemFieldDefRow } from './ItemCustomFields';
import type { ItemRow } from './ItemsTable';
import { apiError, apiSend } from '@/lib/apiClient';
import Modal from '@/components/Modal';

export type { ItemFieldDefRow };

const LIGHTING_CATEGORY = 'Lighting';

interface VendorOption {
  id: string;
  name: string;
}

interface ItemTypeOption {
  id: string;
  category: string;
  name: string;
}

export default function ItemDetailModal({
  item,
  projectId,
  vendors,
  itemTypeOptions,
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
  itemTypeOptions: ItemTypeOption[];
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
    itemType: item.itemTypeName ?? '',
    dimensionHeight: item.dimensionHeight ?? '',
    dimensionWidth: item.dimensionWidth ?? '',
    dimensionLength: item.dimensionLength ?? '',
    dimensionUnit: item.dimensionUnit,
    weight: item.weight ?? '',
    bulbSpec: item.bulbSpec ?? '',
    bulbQty: item.bulbQty ?? '',
    bulbIncluded: item.bulbIncluded,
    finish: item.finish ?? '',
    link: item.link ?? '',
    shippingNotes: item.shippingNotes ?? '',
    platformFee: item.platformFee,
    vendorId: item.vendorId ?? '',
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
  const isLighting = item.category === LIGHTING_CATEGORY;
  const relevantItemTypes = itemTypeOptions.filter((t) => t.category === item.category);

  const priced = priceItem(
    {
      unitCost: form.unitCost,
      platformFee: form.platformFee,
      qty: form.qty,
      markupPct: form.markupPct === '' ? null : form.markupPct,
      markupMode: form.markupMode || null,
    },
    { defaultMarkupPct: projectDefaultMarkupPct, markupMode: projectMarkupMode }
  );

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
      dimensionHeight: form.dimensionHeight === '' ? null : Number(form.dimensionHeight),
      dimensionWidth: form.dimensionWidth === '' ? null : Number(form.dimensionWidth),
      dimensionLength: form.dimensionLength === '' ? null : Number(form.dimensionLength),
      weight: form.weight === '' ? null : Number(form.weight),
      bulbQty: form.bulbQty === '' ? null : Number(form.bulbQty),
    };

    const res = await apiSend(`/api/items/${item.id}`, 'PATCH', payload);

    setSaving(false);

    if (!res.ok) {
      setError(await apiError(res, 'Something went wrong.'));
      return;
    }

    const updated = await res.json();
    onSaved({
      id: item.id,
      ...form,
      itemTypeId: updated.itemTypeId,
      itemTypeName: form.itemType || null,
      markupPct: payload.markupPct === null ? null : String(payload.markupPct),
      dimensionHeight: payload.dimensionHeight === null ? null : String(payload.dimensionHeight),
      dimensionWidth: payload.dimensionWidth === null ? null : String(payload.dimensionWidth),
      dimensionLength: payload.dimensionLength === null ? null : String(payload.dimensionLength),
      weight: payload.weight === null ? null : String(payload.weight),
      bulbQty: payload.bulbQty,
      tag: updated.tag,
    });
  }

  return (
    <>
      <Modal
        width="2xl"
        onSubmit={handleSubmit}
        className="max-h-[90vh] space-y-4 overflow-y-auto"
      >
        <h2 className="text-lg font-medium text-brown">Item Details — {item.tag}</h2>

        {locked && (
          <p className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-brown">
            🔒 Locked to invoice {item.invoiceNumber}. Use &ldquo;Correct this item&rdquo; in the Procurement list to edit.
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
            <label className="mb-1 block text-sm font-medium text-brown">Item Type ({item.category})</label>
            <input
              className="input"
              list="item-detail-type-options"
              placeholder="e.g. Sconce"
              value={form.itemType}
              onChange={(e) => setForm({ ...form, itemType: e.target.value })}
            />
            <datalist id="item-detail-type-options">
              {relevantItemTypes.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="rounded-md border border-taupe/40 p-4">
          <h3 className="mb-3 text-sm font-medium text-brown">Dimensions & Weight</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Height</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                value={form.dimensionHeight}
                onChange={(e) => setForm({ ...form, dimensionHeight: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Width</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                value={form.dimensionWidth}
                onChange={(e) => setForm({ ...form, dimensionWidth: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Length</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                value={form.dimensionLength}
                onChange={(e) => setForm({ ...form, dimensionLength: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Unit</label>
              <select
                className="input"
                value={form.dimensionUnit}
                onChange={(e) => setForm({ ...form, dimensionUnit: e.target.value as 'IN' | 'CM' })}
              >
                <option value="IN">Inches</option>
                <option value="CM">Centimeters</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-brown">Weight (lbs)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="input max-w-[10rem]"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
          </div>
        </div>

        {isLighting && (
          <div className="rounded-md border border-taupe/40 p-4">
            <h3 className="mb-3 text-sm font-medium text-brown">Lighting</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Bulb Spec</label>
                <input
                  className="input"
                  placeholder="e.g. E26, 60W, 2700K"
                  value={form.bulbSpec}
                  onChange={(e) => setForm({ ...form, bulbSpec: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Bulb Qty</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={form.bulbQty}
                  onChange={(e) => setForm({ ...form, bulbQty: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="mt-6 flex items-center gap-4 text-sm text-brown">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.bulbIncluded === true}
                    onChange={(e) => setForm({ ...form, bulbIncluded: e.target.checked ? true : null })}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.bulbIncluded === false}
                    onChange={(e) => setForm({ ...form, bulbIncluded: e.target.checked ? false : null })}
                  />
                  No
                </label>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Finish</label>
          <input className="input" value={form.finish} onChange={(e) => setForm({ ...form, finish: e.target.value })} />
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

        <AttachedDocuments
          listUrl={`/api/items/${item.id}/documents`}
          uploadUrl="/api/documents"
          deleteUrl={(docId) => `/api/documents/${docId}`}
          extraFields={{ projectId, itemId: item.id, type: 'VENDOR_INVOICE' }}
          heading="Documents (quotes, spec sheets…)"
        />

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
      </Modal>
      {enlarged && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
          onClick={() => setEnlarged(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={form.name} className="max-h-full max-w-full rounded" />
        </div>
      )}
    </>
  );
}
