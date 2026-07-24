'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import { apiError, apiSend } from '@/lib/apiClient';
import Modal from '@/components/Modal';

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
    await apiSend(`/api/offerings/${offering.id}`, 'PATCH', { name });
    setSaving(null);
    router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving('new');
    setError(null);

    const res = await apiSend('/api/offerings', 'POST', { name: newName.trim() });
    setSaving(null);

    if (!res.ok) {
      setError(await apiError(res, 'Could not add category.'));
      return;
    }

    setNewName('');
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    await apiSend(`/api/offerings/${pendingDelete.id}`, 'DELETE');
    setDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <>
      <Modal width="md" className="space-y-4">
        <h2 className="text-lg font-medium text-brown">Manage Offering Categories</h2>
        <p className="text-xs text-brown/50">
          Shared between Vendors and line items — rename or remove categories as your firm&rsquo;s vocabulary changes.
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
      </Modal>
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete category?"
        message={`This will remove "${pendingDelete?.name}" from any vendors or items using it.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
