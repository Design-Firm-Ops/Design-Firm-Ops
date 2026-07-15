'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

interface VendorRow {
  id: string;
  name: string;
  website: string | null;
  accountNumber: string | null;
  repName: string | null;
  repEmail: string | null;
  repPhone: string | null;
  notes: string | null;
  _count: { items: number };
}

const emptyForm = {
  name: '',
  website: '',
  accountNumber: '',
  repName: '',
  repEmail: '',
  repPhone: '',
  notes: '',
};

export default function VendorsManager({ initialVendors }: { initialVendors: VendorRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VendorRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(vendor: VendorRow) {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      website: vendor.website ?? '',
      accountNumber: vendor.accountNumber ?? '',
      repName: vendor.repName ?? '',
      repEmail: vendor.repEmail ?? '',
      repPhone: vendor.repPhone ?? '',
      notes: vendor.notes ?? '',
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(editingId ? `/api/vendors/${editingId}` : '/api/vendors', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    setShowForm(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/vendors/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? 'Failed to delete vendor.');
      return;
    }

    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          New Vendor
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-semibold uppercase tracking-wide text-brown/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Rep</th>
              <th className="px-4 py-3">Rep Email</th>
              <th className="px-4 py-3">Rep Phone</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {initialVendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3 font-medium text-brown">{vendor.name}</td>
                <td className="px-4 py-3 text-brown/70">{vendor.repName || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{vendor.repEmail || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{vendor.repPhone || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{vendor._count.items}</td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-sm text-brown hover:text-gold" onClick={() => openEdit(vendor)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-red-700 hover:text-red-900"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(vendor);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {initialVendors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brown/50">
                  No vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-brown">{editingId ? 'Edit Vendor' : 'New Vendor'}</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Name</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Website</label>
              <input
                className="input"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Account Number</label>
              <input
                className="input"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Rep Name</label>
              <input
                className="input"
                value={form.repName}
                onChange={(e) => setForm({ ...form, repName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Rep Email</label>
              <input
                type="email"
                className="input"
                value={form.repEmail}
                onChange={(e) => setForm({ ...form, repEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Rep Phone</label>
              <input
                className="input"
                value={form.repPhone}
                onChange={(e) => setForm({ ...form, repPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete vendor?"
        message={
          deleteError ?? `This will permanently delete "${pendingDelete?.name}". This cannot be undone.`
        }
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
