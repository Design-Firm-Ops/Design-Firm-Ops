'use client';

import { useEffect, useState } from 'react';

interface ProjectOption {
  id: string;
  name: string;
}

interface ItemTypeOption {
  id: string;
  category: string;
  name: string;
}

interface ProcurementListOption {
  id: string;
  name: string;
}

export default function AddItemToProjectModal({
  vendorId,
  activeProjects,
  itemTypeOptions,
  onClose,
  onCreated,
}: {
  vendorId: string;
  activeProjects: ProjectOption[];
  itemTypeOptions: ItemTypeOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState(activeProjects[0]?.id ?? '');
  const [lists, setLists] = useState<ProcurementListOption[]>([]);
  const [form, setForm] = useState({
    tag: '',
    name: '',
    category: '',
    itemType: '',
    room: '',
    procurementListId: '',
    qty: 1,
    unitCost: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLists([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/procurement-lists?projectId=${projectId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) {
          setLists(data);
          setForm((prev) => ({ ...prev, procurementListId: data[0]?.id ?? '', category: data[0]?.name ?? '' }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const relevantItemTypes = itemTypeOptions.filter((t) => t.category === form.category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      setError('Choose a project.');
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, projectId, vendorId }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    onCreated();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg space-y-4 p-6">
        <h2 className="text-lg font-medium text-brown">Add Item to a Project</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Active Project</label>
          <select className="input" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">—</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {activeProjects.length === 0 && <p className="mt-1 text-xs text-brown/50">No active projects yet.</p>}
        </div>

        {lists.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Procurement List</label>
            <select
              className="input"
              value={form.procurementListId}
              onChange={(e) => {
                const list = lists.find((l) => l.id === e.target.value);
                setForm({ ...form, procurementListId: e.target.value, category: list?.name ?? form.category, itemType: '' });
              }}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Tag</label>
            <input
              className="input"
              placeholder="Auto-fills from item type if left blank"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, itemType: '' })}>
              {lists.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Item Type</label>
            <input
              className="input"
              list="add-item-type-options"
              placeholder="e.g. Sconce"
              value={form.itemType}
              onChange={(e) => setForm({ ...form, itemType: e.target.value })}
            />
            <datalist id="add-item-type-options">
              {relevantItemTypes.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Room</label>
            <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Qty</label>
            <input
              type="number"
              min={1}
              className="input"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Unit Cost</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="input"
              required
              value={form.unitCost}
              onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Adding…' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  );
}
