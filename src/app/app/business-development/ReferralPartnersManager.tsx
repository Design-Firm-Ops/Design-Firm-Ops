'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

interface PartnerRow {
  id: string;
  name: string;
  businessName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  _count: { leads: number };
}

const emptyForm = { name: '', businessName: '', contactEmail: '', contactPhone: '', notes: '' };

export default function ReferralPartnersManager({ initialPartners }: { initialPartners: PartnerRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PartnerRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(partner: PartnerRow) {
    setEditingId(partner.id);
    setForm({
      name: partner.name,
      businessName: partner.businessName ?? '',
      contactEmail: partner.contactEmail ?? '',
      contactPhone: partner.contactPhone ?? '',
      notes: partner.notes ?? '',
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(editingId ? `/api/referral-partners/${editingId}` : '/api/referral-partners', {
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

    const res = await fetch(`/api/referral-partners/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? 'Failed to delete partner.');
      return;
    }

    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          New Referral Partner
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-semibold uppercase tracking-wide text-brown/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Leads</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {initialPartners.map((partner) => (
              <tr key={partner.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3 font-medium text-brown">{partner.name}</td>
                <td className="px-4 py-3 text-brown/70">{partner.businessName || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{partner.contactEmail || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{partner.contactPhone || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{partner._count.leads}</td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-sm text-brown hover:text-gold" onClick={() => openEdit(partner)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-red-700 hover:text-red-900"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(partner);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {initialPartners.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brown/50">
                  No referral partners yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold text-brown">{editingId ? 'Edit Referral Partner' : 'New Referral Partner'}</h2>

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
              <label className="mb-1 block text-sm font-medium text-brown">Business Name</label>
              <input
                className="input"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Contact Email</label>
              <input
                type="email"
                className="input"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Contact Phone</label>
              <input
                className="input"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
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
        title="Delete referral partner?"
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
