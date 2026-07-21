'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { priceLine } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import Tooltip from '@/components/Tooltip';
import ItemDetailModal, { ItemFieldDefRow } from './ItemDetailModal';

export interface ItemRow {
  id: string;
  tag: string;
  name: string;
  invoiceDisplayName: string | null;
  category: string;
  itemTypeId: string | null;
  itemTypeName: string | null;
  room: string | null;
  vendorId: string | null;
  procurementListId: string | null;
  imageUrl: string | null;
  qty: number;
  unitCost: string;
  platformFee: string;
  markupPct: string | null;
  markupMode: string | null;
  dimensionHeight: string | null;
  dimensionWidth: string | null;
  dimensionLength: string | null;
  dimensionUnit: string;
  weight: string | null;
  bulbSpec: string | null;
  bulbIncluded: boolean;
  finish: string | null;
  link: string | null;
  shippingNotes: string | null;
  status: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  fieldValues: { fieldDefId: string; value: string | null }[];
}

interface VendorOption {
  id: string;
  name: string;
}

interface ItemTypeOption {
  id: string;
  category: string;
  name: string;
}

const STATUSES = ['PROPOSED', 'APPROVED', 'INVOICED', 'ORDERED', 'RECEIVED', 'DELIVERED'];
const LIGHTING_CATEGORY = 'Lighting';

type GroupBy = 'none' | 'room' | 'vendor' | 'itemType';

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
  procurementListId,
  initialItems,
  vendors,
  categoryOptions,
  defaultCategory,
  itemTypeOptions,
  itemFieldDefs,
  isAdmin,
  canOverrideLock,
  projectDefaultMarkupPct,
  projectMarkupMode,
  copyTargets,
}: {
  projectId: string;
  procurementListId: string | null;
  initialItems: ItemRow[];
  vendors: VendorOption[];
  categoryOptions: string[];
  defaultCategory: string;
  itemTypeOptions: ItemTypeOption[];
  itemFieldDefs: ItemFieldDefRow[];
  isAdmin: boolean;
  canOverrideLock: boolean;
  projectDefaultMarkupPct: string;
  projectMarkupMode: string;
  copyTargets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ItemRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [overriddenIds, setOverriddenIds] = useState<Set<string>>(new Set());
  const [pendingOverride, setPendingOverride] = useState<ItemRow | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  function updateLocal(id: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function isEditable(item: ItemRow) {
    return !item.invoiceId || overriddenIds.has(item.id);
  }

  async function saveField(id: string, patch: Record<string, unknown>) {
    const item = items.find((i) => i.id === id);
    const res = await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item?.invoiceId ? { ...patch, unlockOverride: true } : patch),
    });
    if (res.ok) {
      // The server may auto-fill the tag once an item type is set —
      // reflect that immediately rather than waiting on a full reload.
      const updated = await res.json();
      updateLocal(id, { tag: updated.tag });
    }
    router.refresh();
  }

  function confirmOverride() {
    if (!pendingOverride) return;
    setOverriddenIds((prev) => new Set(prev).add(pendingOverride.id));
    setPendingOverride(null);
  }

  async function handleAddRow() {
    setAddingRow(true);
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        procurementListId: procurementListId && procurementListId !== 'unassigned' ? procurementListId : '',
        tag: '',
        name: 'New Item',
        category: defaultCategory,
        qty: 1,
        unitCost: 0,
      }),
    });
    setAddingRow(false);
    if (res.ok) {
      const created = await res.json();
      setItems((prev) => [
        ...prev,
        { ...created, imageUrl: null, invoiceNumber: null, itemTypeName: null, fieldValues: [] },
      ]);
      router.refresh();
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

  async function handleCopy(itemId: string, procurementListId: string) {
    if (!procurementListId) return;
    setCopyingId(itemId);
    await fetch(`/api/items/${itemId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ procurementListId }),
    });
    setCopyingId(null);
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

  function groupKeyOf(item: ItemRow): string {
    if (groupBy === 'room') return item.room?.trim() || 'No Room';
    if (groupBy === 'vendor') return vendors.find((v) => v.id === item.vendorId)?.name || 'No Vendor';
    if (groupBy === 'itemType') return item.itemTypeName || 'No Item Type';
    return '';
  }

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: null as string | null, items }];
    const map = new Map<string, ItemRow[]>();
    for (const item of items) {
      const key = groupKeyOf(item);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, groupItems]) => ({ label, items: groupItems }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, groupBy, vendors]);

  const COLUMN_COUNT = 21;
  const stickyTh = 'sticky z-20 bg-taupe/10 px-2 py-2';
  const stickyTd = 'sticky z-10 bg-white px-2 py-1';

  function renderRow(item: ItemRow) {
    const priced = computeRow(item, projectDefaultMarkupPct, projectMarkupMode);
    const markupDisplayValue = item.markupPct ?? '';
    const editable = isEditable(item);
    const locked = !editable;
    const isLighting = item.category === LIGHTING_CATEGORY;
    const relevantItemTypes = itemTypeOptions.filter((t) => t.category === item.category);

    return (
      <tr key={item.id} className="hover:bg-taupe/5">
        <td className={`${stickyTd} left-0 w-8`}>
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
        </td>
        <td className={`${stickyTd} left-8 w-12`}>
          <button onClick={() => setDetailItem(item)} title="View / edit item">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded bg-taupe/20 text-brown/30">—</span>
            )}
          </button>
        </td>
        <td className={`${stickyTd} left-20 w-20`}>
          <div className="flex items-center gap-1">
            {locked && (
              <Tooltip reason={`Locked to invoice ${item.invoiceNumber}`}>
                <span className="text-brown/40">🔒</span>
              </Tooltip>
            )}
            <input
              className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={item.tag}
              disabled={locked}
              onChange={(e) => updateLocal(item.id, { tag: e.target.value })}
              onBlur={(e) => saveField(item.id, { tag: e.target.value })}
            />
          </div>
        </td>
        <td className={`${stickyTd} left-[160px] w-36`}>
          <button className="text-left font-medium text-brown hover:text-gold" onClick={() => setDetailItem(item)}>
            {item.name}
          </button>
        </td>
        <td className="px-2 py-1">
          <select
            className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={item.category}
            disabled={locked}
            onChange={(e) => {
              updateLocal(item.id, { category: e.target.value, itemTypeId: null, itemTypeName: null });
              saveField(item.id, { category: e.target.value, itemType: '' });
            }}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1">
          <input
            className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            list={`item-types-${item.id}`}
            value={item.itemTypeName ?? ''}
            disabled={locked}
            placeholder="Type…"
            onChange={(e) => updateLocal(item.id, { itemTypeName: e.target.value })}
            onBlur={(e) => saveField(item.id, { itemType: e.target.value })}
          />
          <datalist id={`item-types-${item.id}`}>
            {relevantItemTypes.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </td>
        <td className="px-2 py-1">
          <input
            className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={item.room ?? ''}
            disabled={locked}
            onChange={(e) => updateLocal(item.id, { room: e.target.value })}
            onBlur={(e) => saveField(item.id, { room: e.target.value })}
          />
        </td>
        <td className="px-2 py-1">
          <select
            className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={item.vendorId ?? ''}
            disabled={locked}
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
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            {(['dimensionHeight', 'dimensionWidth', 'dimensionLength'] as const).map((field, i) => (
              <input
                key={field}
                type="number"
                step="0.01"
                min={0}
                className="w-12 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={['H', 'W', 'L'][i]}
                value={item[field] ?? ''}
                disabled={locked}
                onChange={(e) => updateLocal(item.id, { [field]: e.target.value || null })}
                onBlur={(e) => saveField(item.id, { [field]: e.target.value === '' ? null : Number(e.target.value) })}
              />
            ))}
            <select
              className="rounded border border-transparent bg-transparent px-0.5 py-0.5 text-xs hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={item.dimensionUnit}
              disabled={locked}
              onChange={(e) => {
                updateLocal(item.id, { dimensionUnit: e.target.value });
                saveField(item.id, { dimensionUnit: e.target.value });
              }}
            >
              <option value="IN">in</option>
              <option value="CM">cm</option>
            </select>
          </div>
        </td>
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              min={0}
              className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={item.weight ?? ''}
              disabled={locked}
              onChange={(e) => updateLocal(item.id, { weight: e.target.value || null })}
              onBlur={(e) => saveField(item.id, { weight: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <span className="text-brown/40">lbs</span>
          </div>
        </td>
        <td className="px-2 py-1">
          {isLighting ? (
            <input
              className="w-28 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="e.g. E26, 60W"
              value={item.bulbSpec ?? ''}
              disabled={locked}
              onChange={(e) => updateLocal(item.id, { bulbSpec: e.target.value })}
              onBlur={(e) => saveField(item.id, { bulbSpec: e.target.value })}
            />
          ) : (
            <span className="text-brown/20">—</span>
          )}
        </td>
        <td className="px-2 py-1 text-center">
          {isLighting ? (
            <input
              type="checkbox"
              checked={item.bulbIncluded}
              disabled={locked}
              onChange={(e) => {
                updateLocal(item.id, { bulbIncluded: e.target.checked });
                saveField(item.id, { bulbIncluded: e.target.checked });
              }}
            />
          ) : (
            <span className="text-brown/20">—</span>
          )}
        </td>
        <td className="px-2 py-1 text-right">
          <input
            type="number"
            min={1}
            className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={item.qty}
            disabled={locked}
            onChange={(e) => updateLocal(item.id, { qty: Number(e.target.value) })}
            onBlur={(e) => saveField(item.id, { qty: Number(e.target.value) })}
          />
        </td>
        <td className="px-2 py-1 text-right">
          <input
            type="number"
            step="0.01"
            min={0}
            className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={item.unitCost}
            disabled={locked}
            onChange={(e) => updateLocal(item.id, { unitCost: e.target.value })}
            onBlur={(e) => saveField(item.id, { unitCost: e.target.value })}
          />
        </td>
        <td className="px-2 py-1">
          <input
            type="number"
            step="0.001"
            placeholder={`${projectDefaultMarkupPct}% (default)`}
            className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={markupDisplayValue}
            disabled={locked}
            onChange={(e) => updateLocal(item.id, { markupPct: e.target.value || null })}
            onBlur={(e) => saveField(item.id, { markupPct: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </td>
        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(priced.unitPrice)}</td>
        <td className="px-2 py-1 text-right tabular-nums font-medium">{formatMoney(priced.extended)}</td>
        <td className="px-2 py-1 text-right tabular-nums text-green-800">{formatMoney(priced.profit)}</td>
        <td className="px-2 py-1">
          <select
            className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={item.status}
            disabled={locked}
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
        <td className="px-2 py-1">
          {locked && canOverrideLock ? (
            <button className="whitespace-nowrap text-xs text-gold hover:underline" onClick={() => setPendingOverride(item)}>
              Correct this item
            </button>
          ) : (
            copyTargets.length > 0 && (
              <select
                className="rounded border border-taupe/40 bg-white px-1 py-0.5 text-xs"
                value=""
                disabled={copyingId === item.id}
                onChange={(e) => handleCopy(item.id, e.target.value)}
              >
                <option value="" disabled>
                  {copyingId === item.id ? 'Copying…' : 'Copy to…'}
                </option>
                {copyTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )
          )}
        </td>
        <td className="px-2 py-1 text-right">
          {locked ? (
            <Tooltip reason="Void the invoice to remove this item">
              <span className="text-brown/20">✕</span>
            </Tooltip>
          ) : (
            <button className="text-red-700 hover:text-red-900" onClick={() => setPendingDelete(item)}>
              ✕
            </button>
          )}
        </td>
      </tr>
    );
  }

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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-brown/70">
            Group by
            <select className="input w-auto py-1 text-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="none">None</option>
              <option value="room">Room</option>
              <option value="vendor">Vendor</option>
              <option value="itemType">Item Type</option>
            </select>
          </label>
          <button className="btn-primary" onClick={handleAddRow} disabled={addingRow}>
            {addingRow ? 'Adding…' : '+ Add Row'}
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-xs">
          <thead className="text-left font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className={`${stickyTh} left-0 w-8`}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className={`${stickyTh} left-8 w-12`}>Image</th>
              <th className={`${stickyTh} left-20 w-20`}>Tag</th>
              <th className={`${stickyTh} left-[160px] w-36`}>Name</th>
              <th className="bg-taupe/10 px-2 py-2">Category</th>
              <th className="bg-taupe/10 px-2 py-2">Item Type</th>
              <th className="bg-taupe/10 px-2 py-2">Room</th>
              <th className="bg-taupe/10 px-2 py-2">Vendor</th>
              <th className="bg-taupe/10 px-2 py-2">Dimensions (H x W x L)</th>
              <th className="bg-taupe/10 px-2 py-2">Weight</th>
              <th className="bg-taupe/10 px-2 py-2">Bulb Spec</th>
              <th className="bg-taupe/10 px-2 py-2">Bulb Incl.</th>
              <th className="bg-taupe/10 px-2 py-2 text-right">Qty</th>
              <th className="bg-taupe/10 px-2 py-2 text-right">Unit Cost</th>
              <th className="bg-taupe/10 px-2 py-2">Markup</th>
              <th className="bg-taupe/10 px-2 py-2 text-right">Client Price</th>
              <th className="bg-taupe/10 px-2 py-2 text-right">Extended</th>
              <th className="bg-taupe/10 px-2 py-2 text-right">Profit</th>
              <th className="bg-taupe/10 px-2 py-2">Status</th>
              <th className="bg-taupe/10 px-2 py-2" />
              <th className="bg-taupe/10 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {groups.map((group) => (
              <Fragment key={group.label ?? 'all'}>
                {group.label !== null && (
                  <tr className="bg-taupe/20">
                    <td colSpan={COLUMN_COUNT} className="px-2 py-1.5 text-sm font-semibold text-brown">
                      {group.label} <span className="font-normal text-brown/50">({group.items.length})</span>
                    </td>
                  </tr>
                )}
                {group.items.map((item) => renderRow(item))}
              </Fragment>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-8 text-center text-brown/50">
                  No line items yet. Click "Add Row" to get started.
                </td>
              </tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-brown/30 bg-taupe/10 font-medium text-brown">
                <td colSpan={16} className="px-2 py-2 text-right">
                  Totals
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatMoney(totals.subtotal)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-green-800">{formatMoney(totals.profit)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          projectId={projectId}
          vendors={vendors}
          itemTypeOptions={itemTypeOptions}
          fieldDefs={itemFieldDefs}
          isAdmin={isAdmin}
          projectDefaultMarkupPct={projectDefaultMarkupPct}
          projectMarkupMode={projectMarkupMode}
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

      <ConfirmDialog
        open={!!pendingOverride}
        title="Correct this item?"
        message={`"${pendingOverride?.name}" is locked to invoice ${pendingOverride?.invoiceNumber}. Editing it now will change figures on an already-created invoice.`}
        confirmLabel="Unlock and Edit"
        onConfirm={confirmOverride}
        onCancel={() => setPendingOverride(null)}
      />
    </div>
  );
}
