'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPercent, formatPercentFromFraction } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';

export interface ProjectData {
  id: string;
  name: string;
  projectAddress: string | null;
  status: string;
  startDate: string | null;
  feeStructure: string;
  feeNotes: string | null;
  defaultMarkupPct: string;
  markupMode: string;
  salesTaxRate: string;
  taxBase: string;
  invoicePrefix: string | null;
  client: { id: string; name: string };
}

const STATUSES = ['LEAD', 'ACTIVE', 'ON_HOLD', 'COMPLETE'];
const FEE_STRUCTURES = ['FLAT_FEE', 'HOURLY', 'COST_PLUS', 'HYBRID'];

export default function ProjectHeader({ project }: { project: ProjectData }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: project.name,
    projectAddress: project.projectAddress ?? '',
    status: project.status,
    startDate: project.startDate ? project.startDate.slice(0, 10) : '',
    feeStructure: project.feeStructure,
    feeNotes: project.feeNotes ?? '',
    defaultMarkupPct: project.defaultMarkupPct,
    markupMode: project.markupMode,
    salesTaxRate: project.salesTaxRate,
    taxBase: project.taxBase,
    invoicePrefix: project.invoicePrefix ?? '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
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
    setDeleting(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      router.push('/app/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="card mb-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-brown">{project.name}</h1>
          <p className="text-brown/60">{project.client.name}</p>
          {project.projectAddress && <p className="text-sm text-brown/50">{project.projectAddress}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowForm(true)}>
            Edit
          </button>
          <button className="btn-danger" onClick={() => setPendingDelete(true)}>
            Delete Project
          </button>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-brown/50">Status</dt>
          <dd className="font-medium">{project.status.replace('_', ' ')}</dd>
        </div>
        <div>
          <dt className="text-brown/50">Start Date</dt>
          <dd className="font-medium">{project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</dd>
        </div>
        <div>
          <dt className="text-brown/50">Fee Structure</dt>
          <dd className="font-medium">{project.feeStructure.replace('_', ' ')}</dd>
        </div>
        <div>
          <dt className="text-brown/50">Default Markup</dt>
          <dd className="font-medium">
            {formatPercent(project.defaultMarkupPct)} ({project.markupMode.toLowerCase()})
          </dd>
        </div>
        <div>
          <dt className="text-brown/50">Sales Tax</dt>
          <dd className="font-medium">
            {formatPercentFromFraction(project.salesTaxRate)} on{' '}
            {project.taxBase === 'MERCH_PLUS_SHIPPING' ? 'merch + shipping' : 'merch only'}
          </dd>
        </div>
        <div>
          <dt className="text-brown/50">Invoice Prefix</dt>
          <dd className="font-medium">{project.invoicePrefix || '—'}</dd>
        </div>
        {project.feeNotes && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-brown/50">Fee Notes</dt>
            <dd>{project.feeNotes}</dd>
          </div>
        )}
      </dl>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <form onSubmit={handleSubmit} className="card w-full max-w-2xl space-y-4 p-6">
            <h2 className="text-lg font-semibold text-brown">Edit Project</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-brown">Name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-brown">Project Address</label>
                <input
                  className="input"
                  value={form.projectAddress}
                  onChange={(e) => setForm({ ...form, projectAddress: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Status</label>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Fee Structure</label>
                <select
                  className="input"
                  value={form.feeStructure}
                  onChange={(e) => setForm({ ...form, feeStructure: e.target.value })}
                >
                  {FEE_STRUCTURES.map((f) => (
                    <option key={f} value={f}>
                      {f.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Invoice Prefix</label>
                <input
                  className="input"
                  placeholder="e.g. 2506"
                  value={form.invoicePrefix}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Default Markup %</label>
                <input
                  type="number"
                  step="0.001"
                  className="input"
                  value={form.defaultMarkupPct}
                  onChange={(e) => setForm({ ...form, defaultMarkupPct: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Markup Mode</label>
                <select className="input" value={form.markupMode} onChange={(e) => setForm({ ...form, markupMode: e.target.value })}>
                  <option value="MARKUP">Markup %</option>
                  <option value="MARGIN">Margin %</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Sales Tax Rate (e.g. 0.07)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input"
                  value={form.salesTaxRate}
                  onChange={(e) => setForm({ ...form, salesTaxRate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Tax Base</label>
                <select className="input" value={form.taxBase} onChange={(e) => setForm({ ...form, taxBase: e.target.value })}>
                  <option value="MERCH_ONLY">Merchandise only</option>
                  <option value="MERCH_PLUS_SHIPPING">Merchandise + shipping</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-brown">Fee Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.feeNotes}
                  onChange={(e) => setForm({ ...form, feeNotes: e.target.value })}
                />
              </div>
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
        open={pendingDelete}
        title="Delete project?"
        message={`This will permanently delete "${project.name}" and all of its items, invoices, documents, and payments. This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </div>
  );
}
