'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { priceItem } from '@/lib/financials';
import { formatMoney } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import Tooltip from '@/components/Tooltip';
import ItemDetailModal, { ItemFieldDefRow } from './ItemDetailModal';
import { apiError, apiSend } from '@/lib/apiClient';
import Modal from '@/components/Modal';

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
  bulbQty: number | null;
  bulbIncluded: boolean | null;
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
  return priceItem(item, { defaultMarkupPct: projectDefaultMarkupPct, markupMode: projectMarkupMode });
}

export default function ItemsTable({
  projectId,
  procurementListId,
  initialItems,
  vendors,
  categoryOptions,
  defaultCategory,
  itemTypeOptions,
  roomOptions,
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
  roomOptions: string[];
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
  const [itemTypeOptionsState, setItemTypeOptionsState] = useState(itemTypeOptions);
  const [roomOptionsState, setRoomOptionsState] = useState(roomOptions);
  const [showAddItemType, setShowAddItemType] = useState(false);
  const [newItemTypeCategory, setNewItemTypeCategory] = useState(defaultCategory);
  const [newItemTypeName, setNewItemTypeName] = useState('');
  const [addingItemType, setAddingItemType] = useState(false);
  const [addItemTypeError, setAddItemTypeError] = useState<string | null>(null);

  function updateLocal(id: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function isEditable(item: ItemRow) {
    return !item.invoiceId || overriddenIds.has(item.id);
  }

  async function saveField(id: string, patch: Record<string, unknown>) {
    const item = items.find((i) => i.id === id);
    const res = await apiSend(`/api/items/${id}`, 'PATCH', item?.invoiceId ? { ...patch, unlockOverride: true } : patch);
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
    const res = await apiSend('/api/items', 'POST', {
        projectId,
        procurementListId: procurementListId && procurementListId !== 'unassigned' ? procurementListId : '',
        tag: '',
        name: 'New Item',
        category: defaultCategory,
        qty: 1,
        unitCost: 0,
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

  async function handleAddItemType(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemTypeName.trim()) return;
    setAddingItemType(true);
    setAddItemTypeError(null);

    const res = await apiSend('/api/item-types', 'POST', { category: newItemTypeCategory, name: newItemTypeName.trim() });
    setAddingItemType(false);

    if (!res.ok) {
      setAddItemTypeError(await apiError(res, 'Could not add item type.'));
      return;
    }

    const created = await res.json();
    setItemTypeOptionsState((prev) =>
      prev.some((t) => t.id === created.id) ? prev : [...prev, created],
    );
    setShowAddItemType(false);
    setNewItemTypeName('');
    router.refresh();
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
    await apiSend('/api/items/bulk', 'POST', { ids: Array.from(selected), action: 'delete' });
    setBulkBusy(false);
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
    router.refresh();
  }

  async function handleBulkStatus(status: string) {
    if (!status) return;
    setBulkBusy(true);
    await apiSend('/api/items/bulk', 'POST', { ids: Array.from(selected), action: 'setStatus', status });
    setBulkBusy(false);
    setItems((prev) => prev.map((i) => (selected.has(i.id) ? { ...i, status } : i)));
    router.refresh();
  }

  async function confirmDeleteRow() {
    if (!pendingDelete) return;
    setDeleting(true);
    await apiSend(`/api/items/${pendingDelete.id}`, 'DELETE');
    setDeleting(false);
    setItems((prev) => prev.filter((i) => i.id !== pendingDelete.id));
    setPendingDelete(null);
    router.refresh();
  }

  async function handleCopy(itemId: string, procurementListId: string) {
    if (!procurementListId) return;
    setCopyingId(itemId);
    await apiSend(`/api/items/${itemId}/copy`, 'POST', { procurementListId });
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

  const COLUMN_COUNT = 22;
  const stickyTh = 'sticky z-20 bg-[#f8f6f3] px-2 py-2';
  const stickyTd = 'sticky z-10 bg-white px-2 py-1';

  const bulbGroups = useMemo(() => {
    const map = new Map<string, { spec: string; qty: number; items: string[] }>();
    for (const item of items) {
      if (item.category !== LIGHTING_CATEGORY) continue;
      if (item.bulbIncluded !== false || !item.bulbQty) continue;
      const spec = item.bulbSpec?.trim();
      if (!spec) continue;
      const existing = map.get(spec) ?? { spec, qty: 0, items: [] };
      existing.qty += item.qty * item.bulbQty;
      existing.items.push(item.tag ? `${item.tag} — ${item.name}` : item.name);
      map.set(spec, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.spec.localeCompare(b.spec));
  }, [items]);

  function renderRow(item: ItemRow) {
    const priced = computeRow(item, projectDefaultMarkupPct, projectMarkupMode);
    const markupDisplayValue = item.markupPct ?? '';
    const editable = isEditable(item);
    const locked = !editable;
    const isLighting = item.category === LIGHTING_CATEGORY;
    const relevantItemTypes = itemTypeOptionsState.filter((t) => t.category === item.category);

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
            onBlur={(e) => {
              const value = e.target.value;
              saveField(item.id, { itemType: value });
              const trimmed = value.trim();
              if (trimmed && !relevantItemTypes.some((t) => t.name === trimmed)) {
                setItemTypeOptionsState((prev) => [
                  ...prev,
                  { id: `pending-${item.category}-${trimmed}`, category: item.category, name: trimmed },
                ]);
              }
            }}
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
            list={`room-options-${item.id}`}
            value={item.room ?? ''}
            disabled={locked}
            onChange={(e) => updateLocal(item.id, { room: e.target.value })}
            onBlur={(e) => {
              const value = e.target.value;
              saveField(item.id, { room: value });
              const trimmed = value.trim();
              if (trimmed && !roomOptionsState.includes(trimmed)) {
                setRoomOptionsState((prev) => [...prev, trimmed]);
              }
            }}
          />
          <datalist id={`room-options-${item.id}`}>
            {roomOptionsState.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
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
        <td className="px-2 py-1 text-right">
          {isLighting ? (
            <input
              type="number"
              min={0}
              className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-taupe/40 focus:border-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={item.bulbQty ?? ''}
              disabled={locked}
              onChange={(e) => updateLocal(item.id, { bulbQty: e.target.value === '' ? null : Number(e.target.value) })}
              onBlur={(e) => saveField(item.id, { bulbQty: e.target.value === '' ? null : Number(e.target.value) })}
            />
          ) : (
            <span className="text-brown/20">—</span>
          )}
        </td>
        <td className="px-2 py-1 text-center">
          {isLighting ? (
            <div className="flex items-center justify-center gap-2">
              <label className="flex items-center gap-1 text-brown/70">
                <input
                  type="checkbox"
                  checked={item.bulbIncluded === true}
                  disabled={locked}
                  onChange={(e) => {
                    const value = e.target.checked ? true : null;
                    updateLocal(item.id, { bulbIncluded: value });
                    saveField(item.id, { bulbIncluded: value });
                  }}
                />
                Yes
              </label>
              <label className="flex items-center gap-1 text-brown/70">
                <input
                  type="checkbox"
                  checked={item.bulbIncluded === false}
                  disabled={locked}
                  onChange={(e) => {
                    const value = e.target.checked ? false : null;
                    updateLocal(item.id, { bulbIncluded: value });
                    saveField(item.id, { bulbIncluded: value });
                  }}
                />
                No
              </label>
            </div>
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
          <button
            className="btn-secondary"
            onClick={() => {
              setNewItemTypeCategory(defaultCategory);
              setNewItemTypeName('');
              setAddItemTypeError(null);
              setShowAddItemType(true);
            }}
          >
            + Add Item Type
          </button>
          <button className="btn-primary" onClick={handleAddRow} disabled={addingRow}>
            {addingRow ? 'Adding…' : '+ Add Row'}
          </button>
        </div>
      </div>

      {showAddItemType && (
        <Modal width="sm" onSubmit={handleAddItemType} className="space-y-4">
          <h2 className="text-lg font-medium text-brown">Add Item Type</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Category</label>
            <select
              className="input"
              value={newItemTypeCategory}
              onChange={(e) => setNewItemTypeCategory(e.target.value)}
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Name</label>
            <input
              className="input"
              placeholder="e.g. Bench"
              value={newItemTypeName}
              autoFocus
              onChange={(e) => setNewItemTypeName(e.target.value)}
            />
          </div>
          {addItemTypeError && <p className="text-sm text-red-700">{addItemTypeError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowAddItemType(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={addingItemType}>
              {addingItemType ? 'Adding…' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

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
              <th className="bg-taupe/10 px-2 py-2 text-right">Bulb Qty</th>
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
                  No line items yet. Click &ldquo;Add Row&rdquo; to get started.
                </td>
              </tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-brown/30 bg-taupe/10 font-medium text-brown">
                <td colSpan={17} className="px-2 py-2 text-right">
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

      {bulbGroups.length > 0 && (
        <div className="card mt-4 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-taupe">Bulbs</h3>
          <table className="min-w-full divide-y divide-taupe/30 text-xs">
            <thead className="text-left font-medium uppercase tracking-[0.2em] text-taupe">
              <tr>
                <th className="px-2 py-2">Bulb Spec</th>
                <th className="px-2 py-2 text-right">Total Qty</th>
                <th className="px-2 py-2">Used In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {bulbGroups.map((g) => (
                <tr key={g.spec}>
                  <td className="px-2 py-1 font-medium text-brown">{g.spec}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{g.qty}</td>
                  <td className="px-2 py-1 text-brown/70">{g.items.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          projectId={projectId}
          vendors={vendors}
          itemTypeOptions={itemTypeOptionsState}
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
