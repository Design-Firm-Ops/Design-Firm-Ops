'use client';

import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { LeadRow, StageRow } from './LeadsBoard';

export default function LeadFormModal({
  lead,
  stages,
  referralPartners,
  projectTypeOptions,
  onClose,
  onSaved,
}: {
  lead: LeadRow | null;
  stages: StageRow[];
  referralPartners: { id: string; name: string }[];
  projectTypeOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    clientName: lead?.clientName ?? '',
    projectType: lead?.projectType ?? '',
    referralSource: lead?.referralSource ?? '',
    referralPartnerId: lead?.referralPartnerId ?? '',
    contactEmail: lead?.contactEmail ?? '',
    contactPhone: lead?.contactPhone ?? '',
    address: lead?.address ?? '',
    notes: lead?.notes ?? '',
    pipelineStageId: lead?.pipelineStageId ?? stages[0]?.id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(lead ? `/api/leads/${lead.id}` : '/api/leads', {
      method: lead ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    onSaved();
  }

  async function confirmDelete() {
    if (!lead) return;
    setDeleting(true);
    await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
    setDeleting(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg space-y-4 p-6">
        <h2 className="text-lg font-semibold text-brown">{lead ? 'Edit Lead' : 'New Lead'}</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Client Name</label>
          <input
            className="input"
            required
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Project Type</label>
            <input
              className="input"
              list="lead-project-type-options"
              value={form.projectType}
              onChange={(e) => setForm({ ...form, projectType: e.target.value })}
            />
            <datalist id="lead-project-type-options">
              {projectTypeOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Stage</label>
            <select
              className="input"
              value={form.pipelineStageId}
              onChange={(e) => setForm({ ...form, pipelineStageId: e.target.value })}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Referral Source</label>
            <input
              className="input"
              placeholder="e.g. Instagram, existing client"
              value={form.referralSource}
              onChange={(e) => setForm({ ...form, referralSource: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Referral Partner</label>
            <select
              className="input"
              value={form.referralPartnerId}
              onChange={(e) => setForm({ ...form, referralPartnerId: e.target.value })}
            >
              <option value="">—</option>
              {referralPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Email</label>
            <input
              type="email"
              className="input"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Phone</label>
            <input
              className="input"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Address</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Notes</label>
          <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex items-center justify-between">
          {lead ? (
            <button type="button" className="text-sm text-red-700 hover:text-red-900" onClick={() => setPendingDelete(true)}>
              Delete Lead
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={pendingDelete}
        title="Delete lead?"
        message={`This will permanently delete "${lead?.clientName}" from the pipeline. This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </div>
  );
}
