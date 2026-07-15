'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  notes: string | null;
  _count: { projects: number };
}

const emptyForm = { name: '', email: '', phone: '', billingAddress: '', notes: '' };

export default function ClientsManager({ initialClients }: { initialClients: ClientRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(client: ClientRow) {
    setEditingId(client.id);
    setForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      billingAddress: client.billingAddress ?? '',
      notes: client.notes ?? '',
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(editingId ? `/api/clients/${editingId}` : '/api/clients', {
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

    const res = await fetch(`/api/clients/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? 'Failed to delete client.');
      return;
    }

    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          New Client
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-semibold uppercase tracking-wide text-brown/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {initialClients.map((client) => (
              <tr key={client.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3 font-medium text-brown">{client.name}</td>
                <td className="px-4 py-3 text-brown/70">{client.email || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{client.phone || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{client._count.projects}</td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-sm text-brown hover:text-gold" onClick={() => openEdit(client)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-red-700 hover:text-red-900"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(client);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {initialClients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brown/50">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold text-brown">{editingId ? 'Edit Client' : 'New Client'}</h2>

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
              <label className="mb-1 block text-sm font-medium text-brown">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Billing Address</label>
              <textarea
                className="input"
                rows={2}
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
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
        title="Delete client?"
        message={
          deleteError ??
          `This will permanently delete "${pendingDelete?.name}". This cannot be undone.`
        }
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
