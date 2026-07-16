'use client';

import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { LeadRow, StageRow } from './LeadsBoard';

const NEW_PARTNER_VALUE = '__new__';

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
    squareFootage: lead?.squareFootage != null ? String(lead.squareFootage) : '',
    estimatedBudget: lead?.estimatedBudget ?? '',
    timeline: lead?.timeline ?? '',
    builderName: lead?.builderName ?? '',
    architectName: lead?.architectName ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [partners, setPartners] = useState(referralPartners);
  const [showNewPartner, setShowNewPartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ name: '', businessName: '', contactEmail: '', contactPhone: '' });
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  function handleReferralPartnerChange(value: string) {
    if (value === NEW_PARTNER_VALUE) {
      setShowNewPartner(true);
      setPartnerError(null);
      return;
    }
    setForm({ ...form, referralPartnerId: value });
  }

  async function handleCreatePartner() {
    if (!newPartner.name.trim()) {
      setPartnerError('Name is required');
      return;
    }
    setCreatingPartner(true);
    setPartnerError(null);

    const res = await fetch('/api/referral-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPartner),
    });

    setCreatingPartner(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setPartnerError(data?.error ? JSON.stringify(data.error) : 'Could not create partner.');
      return;
    }

    const created = await res.json();
    setPartners((prev) => [...prev, { id: created.id, name: created.name }]);
    setForm((prev) => ({ ...prev, referralPartnerId: created.id }));
    setShowNewPartner(false);
    setNewPartner({ name: '', businessName: '', contactEmail: '', contactPhone: '' });
  }

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
              onChange={(e) => handleReferralPartnerChange(e.target.value)}
            >
              <option value="">—</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value={NEW_PARTNER_VALUE}>+ New referral partner…</option>
            </select>
          </div>
        </div>

        {showNewPartner && (
          <div className="space-y-3 rounded-md border border-taupe/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brown">New Referral Partner</h3>
              <button
                type="button"
                className="text-xs text-brown/50 hover:text-brown"
                onClick={() => setShowNewPartner(false)}
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-brown">Name</label>
                <input
                  className="input"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-brown">Business Name</label>
                <input
                  className="input"
                  value={newPartner.businessName}
                  onChange={(e) => setNewPartner({ ...newPartner, businessName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Email</label>
                <input
                  type="email"
                  className="input"
                  value={newPartner.contactEmail}
                  onChange={(e) => setNewPartner({ ...newPartner, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Phone</label>
                <input
                  className="input"
                  value={newPartner.contactPhone}
                  onChange={(e) => setNewPartner({ ...newPartner, contactPhone: e.target.value })}
                />
              </div>
            </div>
            {partnerError && <p className="text-xs text-red-700">{partnerError}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-secondary py-1.5 text-xs"
                onClick={handleCreatePartner}
                disabled={creatingPartner}
              >
                {creatingPartner ? 'Adding…' : 'Add Partner'}
              </button>
            </div>
          </div>
        )}

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

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Square Footage</label>
            <input
              type="number"
              min={0}
              className="input"
              value={form.squareFootage}
              onChange={(e) => setForm({ ...form, squareFootage: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Estimated Budget</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={form.estimatedBudget}
              onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Timeline</label>
            <input
              className="input"
              placeholder="e.g. Fall 2026"
              value={form.timeline}
              onChange={(e) => setForm({ ...form, timeline: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Builder</label>
            <input
              className="input"
              value={form.builderName}
              onChange={(e) => setForm({ ...form, builderName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Architect</label>
            <input
              className="input"
              value={form.architectName}
              onChange={(e) => setForm({ ...form, architectName: e.target.value })}
            />
          </div>
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
