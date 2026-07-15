'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { priceLine } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import ItemDetailModal from './ItemDetailModal';

export interface ItemRow {
  id: string;
  tag: string;
  name: string;
  invoiceDisplayName: string | null;
  category: string;
  room: string | null;
  vendorId: string | null;
  qty: number;
  unitCost: string;
  platformFee: string;
  markupPct: string | null;
  markupMode: string | null;
  dimensions: string | null;
  finish: string | null;
  link: string | null;
  shippingNotes: string | null;
  status: string;
  invoiceId: string | null;
}

interface VendorOption {
  id: string;
  name: string;
}

const CATEGORIES = [
  'LIGHTING',
  'FURNITURE',
  'PLUMBING',
  'HARDWARE',
  'TEXTILES',
  'ART',
  'ACCESSORIES',
  'APPLIANCES',
  'OTHER',
];

const STATUSES = ['PROPOSED', 'APPROVED', 'INVOICED', 'ORDERED', 'RECEIVED', 'DELIVERED'];

function computeRow(item: ItemRow, projectDefaultMarkupPct: string, projectMarkupMode: string) {
  const priced = priceLine({
    unitCost: item.unitCost,
    platformFee: item.platformFee,
    qty: item.qty,
    markupPct: item.markupPct,
    markupMode: item.markupMode as 'MARKUP' | 'MARGIN' | null,
    projectDefaultMarkupPct,
    projectMarkupMode: projectMarkupMode as 'MARKUP' | 'MARGIN',
  });
  return priced;
}

export default function ItemsTable({
  projectId,
  initialItems,
  vendors,
  projectDefaultMarkupPct,
  projectMarkupMode,
}: {
  projectId: string;
  initialItems: ItemRow[];
  vendors: VendorOption[];
  projectDefaultMarkupPct: string;
  projectMarkupMode: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ItemRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  function updateLocal(id: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function saveField(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    router.refresh();
  }

  async function handleAddRow() {
    setAddingRow(true);
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        tag: `LT-${items.length + 1}`,
        name: 'New Item',
        category: 'OTHER',
        qty: 1,
        unitCost: 0,
      }),
    });
    setAddingRow(false);
    if (res.ok) {
      const created = await res.json();
      setItems((prev) => [...prev, created]);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function handleBulkDelete() {
    setBulkBusy(true);
    await fetch('/api/items/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action: 'delete' }),
    });
    setBulkBusy(false);
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
    router.refresh();
  }

  async function handleBulkStatus(status: string) {
    if (!status) return;
    setBulkBusy(true);
    await fetch('/api/items/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action: 'setStatus', status }),
    });
    setBulkBusy(false);
    setItems((prev) => prev.map((i) => (selected.has(i.id) ? { ...i, status } : i)));
    router.refresh();
  }

  async function confirmDeleteRow() {
    if (!pendingDelete) return;
    setDeleting(true);
    await fetch(`/api/items/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);
    setItems((prev) => prev.filter((i) => i.id !== pendingDelete.id));
    setPendingDelete(null);
    router.refresh();
  }

  const totals = useMemo(() => {
    let subtotal = new Decimal(0);
    let cost = new Decimal(0);
    for (const item of items) {
      const priced = computeRow(item, projectDefaultMarkupPct, projectMarkupMode);
      subtotal = subtotal.plus(priced.extended);
      cost = cost.plus(priced.extendedCost);
    }
    return { subtotal, cost, profit: subtotal.minus(cost) };
  }, [items, projectDefaultMarkupPct, projectMarkupMode]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <>
              <span className="text-sm text-brown/70">{selected.size} selected</span>
              <select
                className="input w-auto py-1 text-sm"
                defaultValue=""
                disabled={bulkBusy}
                onChange={(e) => handleBulkStatus(e.target.value)}
              >
                <option value="" disabled>
                  Set status…
                </option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                className="text-sm text-red-700 hover:text-red-900"
                disabled={bulkBusy}
                onClick={handleBulkDelete}
              >
                Delete selected
              </button>
            </>
          )}
        </div>
        <button className="btn-primary" onClick={handleAddRow} disabled={addingRow}>
          {addingRow ? 'Adding…' : '+ Add Row'}
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-xs">
          <thead className="bg-taupe/10 text-left font-semibold uppercase tracking-wide text-brown/60">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-2 py-2">Tag</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Room</th>
              <th className="px-2 py-2">Vendor</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Unit Cost</th>
              <th className="px-2 py-2">Markup</th>
              <th className="px-2 py-2 text-right">Client Price</th>
              <th className="px-2 py-2 text-right">Extended</th>
              <th className="px-2 py-2 text-right">Profit</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {items.map((item) => {
              const priced = computeRow(item, projectDefaultMarkupPct, projectMarkupMode);
              const markupDisplayValue = item.markupPct ?? '';
              return (
                <tr key={item.id} className="hover:bg-taupe/5">
                  <td className="px-2 py-1">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={item.tag}
                      onChange={(e) => updateLocal(item.id, { tag: e.target.value })}
                      onBlur={(e) => saveField(item.id, { tag: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <button className="text-left font-medium text-brown hover:text-gold" onClick={() => setDetailItem(item)}>
                      {item.name}
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={item.category}
                      onChange={(e) => {
                        updateLocal(item.id, { category: e.target.value });
                        saveField(item.id, { category: e.target.value });
                      }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={item.room ?? ''}
                      onChange={(e) => updateLocal(item.id, { room: e.target.value })}
                      onBlur={(e) => saveField(item.id, { room: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={item.vendorId ?? ''}
                      onChange={(e) => {
                        updateLocal(item.id, { vendorId: e.target.value || null });
                        saveField(item.id, { vendorId: e.target.value });
                      }}
                    >
                      <option value="">—</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      min={1}
                      className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={item.qty}
                      onChange={(e) => updateLocal(item.id, { qty: Number(e.target.value) })}
                      onBlur={(e) => saveField(item.id, { qty: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={item.unitCost}
                      onChange={(e) => updateLocal(item.id, { unitCost: e.target.value })}
                      onBlur={(e) => saveField(item.id, { unitCost: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.001"
                      placeholder={`${projectDefaultMarkupPct}% (default)`}
                      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={markupDisplayValue}
                      onChange={(e) => updateLocal(item.id, { markupPct: e.target.value || null })}
                      onBlur={(e) => saveField(item.id, { markupPct: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatMoney(priced.unitPrice)}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-medium">{formatMoney(priced.extended)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-green-800">{formatMoney(priced.profit)}</td>
                  <td className="px-2 py-1">
                    <select
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none"
                      value={item.status}
                      onChange={(e) => {
                        updateLocal(item.id, { status: e.target.value });
                        saveField(item.id, { status: e.target.value });
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button className="text-red-700 hover:text-red-900" onClick={() => setPendingDelete(item)}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-brown/50">
                  No line items yet. Click "Add Row" to get started.
                </td>
              </tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-brown/30 bg-taupe/10 font-semibold text-brown">
                <td colSpan={10} className="px-2 py-2 text-right">
                  Totals
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatMoney(totals.subtotal)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-green-800">{formatMoney(totals.profit)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onSaved={(updated) => {
            updateLocal(updated.id, updated);
            setDetailItem(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete line item?"
        message={`This will permanently delete "${pendingDelete?.name}". This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDeleteRow}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
