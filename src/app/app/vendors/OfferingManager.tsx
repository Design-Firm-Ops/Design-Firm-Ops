'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

export interface OfferingRow {
  id: string;
  name: string;
}

export default function OfferingManager({ offerings, onClose }: { offerings: OfferingRow[]; onClose: () => void }) {
  const router = useRouter();
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(offerings.map((o) => [o.id, o.name])));
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OfferingRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleRename(offering: OfferingRow) {
    const name = names[offering.id]?.trim();
    if (!name || name === offering.name) return;
    setSaving(offering.id);
    await fetch(`/api/offerings/${offering.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setSaving(null);
    router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving('new');
    setError(null);

    const res = await fetch('/api/offerings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setSaving(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Could not add category.');
      return;
    }

    setNewName('');
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    await fetch(`/api/offerings/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-md space-y-4 p-6">
        <h2 className="text-lg font-medium text-brown">Manage Offering Categories</h2>
        <p className="text-xs text-brown/50">
          Shared between Vendors and line items — rename or remove categories as your firm's vocabulary changes.
        </p>

        <div className="space-y-2">
          {offerings.map((offering) => (
            <div key={offering.id} className="flex items-center gap-2">
              <input
                className="input"
                value={names[offering.id] ?? offering.name}
                onChange={(e) => setNames({ ...names, [offering.id]: e.target.value })}
                onBlur={() => handleRename(offering)}
              />
              <button
                type="button"
                className="text-sm text-red-700 hover:text-red-900"
                onClick={() => setPendingDelete(offering)}
                disabled={saving === offering.id}
              >
                Delete
              </button>
            </div>
          ))}
          {offerings.length === 0 && <p className="text-sm text-brown/50">No categories yet.</p>}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            className="input"
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn-secondary" disabled={saving === 'new'}>
            Add
          </button>
        </form>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete category?"
        message={`This will remove "${pendingDelete?.name}" from any vendors or items using it.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
