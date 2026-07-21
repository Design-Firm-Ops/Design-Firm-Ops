'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { formatMoney } from '@/lib/money';
import ConfirmDialog from '@/components/ConfirmDialog';
import DesignFeeSection, { DesignFeeChargeRow, DesignFeeInvoiceRow } from './DesignFeeSection';
import ProjectCustomFields, { FieldDefRow, FieldValueRow } from './ProjectCustomFields';
import ProjectFieldsManager from './ProjectFieldsManager';
import { COLUMN_LABELS, COLUMN_PRESETS, INVOICE_COLUMNS, InvoiceColumnKey, resolveColumnConfig } from '@/lib/invoiceColumns';

export interface ProjectData {
  id: string;
  name: string;
  projectAddress: string | null;
  status: string;
  startDate: string | null;
  projectType: string | null;
  leadDesignerName: string | null;
  designFeeStructure: string | null;
  feeNotes: string | null;
  invoicePrefix: string | null;
  defaultInvoiceColumnConfig: { columns: string[] } | null;
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

export default function ProjectHeader({
  project,
  projectTypeOptions,
  designFeeStructureOptions,
  canViewClientContact,
  canViewFinancials,
  merchandise,
  designFee,
  designFeeCharges,
  designFeeInvoices,
  fieldDefs: initialFieldDefs,
  fieldValues,
  isAdmin,
}: {
  project: ProjectData;
  projectTypeOptions: string[];
  designFeeStructureOptions: string[];
  canViewClientContact: boolean;
  canViewFinancials: boolean;
  merchandise: MerchandiseFinancials;
  designFee: DesignFeeFinancials;
  designFeeCharges: DesignFeeChargeRow[];
  designFeeInvoices: DesignFeeInvoiceRow[];
  fieldDefs: FieldDefRow[];
  fieldValues: FieldValueRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [fieldDefs, setFieldDefs] = useState(initialFieldDefs);
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
    designFeeStructure: project.designFeeStructure ?? '',
    feeNotes: project.feeNotes ?? '',
    invoicePrefix: project.invoicePrefix ?? '',
  });
  const [invoiceColumns, setInvoiceColumns] = useState<string[] | null>(project.defaultInvoiceColumnConfig?.columns ?? null);
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
      body: JSON.stringify({
        ...form,
        defaultInvoiceColumnConfig: invoiceColumns ? { columns: invoiceColumns } : null,
      }),
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
          <h1 className="text-2xl font-medium text-brown">{project.name}</h1>
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
          <dt className="text-brown/50">Design Fee Structure</dt>
          <dd className="font-medium">{project.designFeeStructure || '—'}</dd>
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
            <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-taupe">Client Contact</h2>
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
          <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-taupe">Financial Summary</h2>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Merchandise</p>
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
                <dd className="tabular-nums font-medium text-brown">{formatMoney(merchandise.outstanding)}</dd>
              </div>
            </dl>
          </div>

          <DesignFeeSection
            projectId={project.id}
            summary={designFee}
            charges={designFeeCharges}
            invoices={designFeeInvoices}
          />
        </div>
      )}

      <ProjectCustomFields projectId={project.id} fieldDefs={fieldDefs} fieldValues={fieldValues} isAdmin={isAdmin} />

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <form onSubmit={handleSubmit} className="card w-full max-w-2xl space-y-4 p-6">
            <h2 className="text-lg font-medium text-brown">Edit Project</h2>

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
                <label className="mb-1 block text-sm font-medium text-brown">Design Fee Structure</label>
                <input
                  className="input"
                  list="design-fee-structure-options"
                  placeholder="e.g. Fixed Fee"
                  value={form.designFeeStructure}
                  onChange={(e) => setForm({ ...form, designFeeStructure: e.target.value })}
                />
                <datalist id="design-fee-structure-options">
                  {designFeeStructureOptions.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
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

            <div className="rounded-md border border-taupe/40 p-4">
              <p className="mb-1 text-sm font-medium text-brown">Default invoice columns shown to client</p>
              <p className="mb-3 text-xs text-brown/50">
                New invoices inherit this unless a column selection is set on the invoice itself.
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    className="rounded-full border border-taupe/50 px-3 py-1 text-xs text-brown hover:border-gold"
                    onClick={() => setInvoiceColumns(preset.config.columns)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                {INVOICE_COLUMNS.map((col) => {
                  const resolved = resolveColumnConfig(invoiceColumns ? { columns: invoiceColumns } : null);
                  return (
                    <label key={col} className="flex items-center gap-1.5 text-sm text-brown">
                      <input
                        type="checkbox"
                        checked={resolved.columns.includes(col)}
                        onChange={(e) => {
                          const base = invoiceColumns ?? resolved.columns;
                          const next = e.target.checked ? [...base, col] : base.filter((c) => c !== col);
                          setInvoiceColumns(INVOICE_COLUMNS.filter((c) => (next as InvoiceColumnKey[]).includes(c)));
                        }}
                      />
                      {COLUMN_LABELS[col]}
                    </label>
                  );
                })}
              </div>
            </div>

            {isAdmin && <ProjectFieldsManager fieldDefs={fieldDefs} onChange={setFieldDefs} />}

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
            <h2 className="text-lg font-medium text-brown">Edit Client Contact</h2>

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
