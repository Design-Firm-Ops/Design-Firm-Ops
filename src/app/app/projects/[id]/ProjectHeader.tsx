'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { formatMoney, formatPercent, formatPercentFromFraction } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import DesignFeeSection from './DesignFeeSection';

export interface ProjectData {
  id: string;
  name: string;
  projectAddress: string | null;
  status: string;
  startDate: string | null;
  projectType: string | null;
  leadDesignerName: string | null;
  feeStructure: string;
  feeNotes: string | null;
  defaultMarkupPct: string;
  markupMode: string;
  salesTaxRate: string;
  taxBase: string;
  invoicePrefix: string | null;
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    billingAddress: string | null;
  };
}

export interface MerchandiseFinancials {
  invoicedTotal: Decimal.Value;
  paidTotal: Decimal.Value;
  outstanding: Decimal.Value;
}

export interface DesignFeeFinancials {
  billed: Decimal.Value;
  paid: Decimal.Value;
  outstanding: Decimal.Value;
}

const STATUSES = ['LEAD', 'ACTIVE', 'ON_HOLD', 'COMPLETE'];
const FEE_STRUCTURES = ['FLAT_FEE', 'HOURLY', 'COST_PLUS', 'HYBRID'];

export default function ProjectHeader({
  project,
  projectTypeOptions,
  canViewClientContact,
  canViewFinancials,
  merchandise,
  designFee,
}: {
  project: ProjectData;
  projectTypeOptions: string[];
  canViewClientContact: boolean;
  canViewFinancials: boolean;
  merchandise: MerchandiseFinancials;
  designFee: DesignFeeFinancials;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: project.name,
    projectAddress: project.projectAddress ?? '',
    status: project.status,
    startDate: project.startDate ? project.startDate.slice(0, 10) : '',
    projectType: project.projectType ?? '',
    leadDesignerName: project.leadDesignerName ?? '',
    feeStructure: project.feeStructure,
    feeNotes: project.feeNotes ?? '',
    defaultMarkupPct: project.defaultMarkupPct,
    markupMode: project.markupMode,
    salesTaxRate: project.salesTaxRate,
    taxBase: project.taxBase,
    invoicePrefix: project.invoicePrefix ?? '',
  });
  const [clientForm, setClientForm] = useState({
    name: project.client.name,
    email: project.client.email ?? '',
    phone: project.client.phone ?? '',
    billingAddress: project.client.billingAddress ?? '',
  });
  const [savingClient, setSavingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

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

  async function handleClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingClient(true);
    setClientError(null);

    const res = await fetch(`/api/clients/${project.client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientForm),
    });

    setSavingClient(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setClientError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    setShowClientForm(false);
    router.refresh();
  }

  async function confirmDelete() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      router.push('/app/projects');
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
          <dt className="text-brown/50">Project Type</dt>
          <dd className="font-medium">{project.projectType || '—'}</dd>
        </div>
        <div>
          <dt className="text-brown/50">Lead Designer</dt>
          <dd className="font-medium">{project.leadDesignerName || '—'}</dd>
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

      {canViewClientContact && (
        <div className="mt-6 border-t border-taupe/30 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brown/60">Client Contact</h2>
            <button className="text-sm text-brown hover:text-gold" onClick={() => setShowClientForm(true)}>
              Edit
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-brown/50">Email</dt>
              <dd className="font-medium">{project.client.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-brown/50">Phone</dt>
              <dd className="font-medium">{project.client.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-brown/50">Billing Address</dt>
              <dd className="font-medium">{project.client.billingAddress || '—'}</dd>
            </div>
          </dl>
        </div>
      )}

      {canViewFinancials && (
        <div className="mt-6 space-y-4 border-t border-taupe/30 pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brown/60">Financial Summary</h2>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brown/50">Merchandise</p>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-brown/50">Invoiced</dt>
                <dd className="tabular-nums font-medium">{formatMoney(merchandise.invoicedTotal)}</dd>
              </div>
              <div>
                <dt className="text-brown/50">Paid</dt>
                <dd className="tabular-nums font-medium">{formatMoney(merchandise.paidTotal)}</dd>
              </div>
              <div>
                <dt className="text-brown/50">Outstanding</dt>
                <dd className="tabular-nums font-semibold text-brown">{formatMoney(merchandise.outstanding)}</dd>
              </div>
            </dl>
          </div>

          <DesignFeeSection projectId={project.id} summary={designFee} />
        </div>
      )}

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
                <label className="mb-1 block text-sm font-medium text-brown">Project Type</label>
                <input
                  className="input"
                  list="project-type-options"
                  placeholder="e.g. Full Remodel"
                  value={form.projectType}
                  onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                />
                <datalist id="project-type-options">
                  {projectTypeOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brown">Lead Designer</label>
                <input
                  className="input"
                  value={form.leadDesignerName}
                  onChange={(e) => setForm({ ...form, leadDesignerName: e.target.value })}
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

      {showClientForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleClientSubmit} className="card w-full max-w-md space-y-4 p-6">
            <h2 className="text-lg font-semibold text-brown">Edit Client Contact</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Name</label>
              <input
                className="input"
                required
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Email</label>
              <input
                type="email"
                className="input"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Phone</label>
              <input
                className="input"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brown">Billing Address</label>
              <textarea
                className="input"
                rows={2}
                value={clientForm.billingAddress}
                onChange={(e) => setClientForm({ ...clientForm, billingAddress: e.target.value })}
              />
            </div>

            {clientError && <p className="text-sm text-red-700">{clientError}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowClientForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingClient}>
                {savingClient ? 'Saving…' : 'Save'}
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
