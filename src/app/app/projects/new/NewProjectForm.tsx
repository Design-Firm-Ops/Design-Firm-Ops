'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiError, apiSend } from '@/lib/apiClient';

export default function NewProjectForm({
  clients,
  projectTypeOptions,
  designFeeStructureOptions,
  procurementFeeStructureOptions,
}: {
  clients: { id: string; name: string }[];
  projectTypeOptions: string[];
  designFeeStructureOptions: string[];
  procurementFeeStructureOptions: string[];
}) {
  const router = useRouter();
  const [useNewClient, setUseNewClient] = useState(clients.length === 0);
  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? '',
    newClientName: '',
    newClientEmail: '',
    newClientPhone: '',
    newClientAddress: '',
    name: '',
    projectAddress: '',
    status: 'LEAD',
    startDate: '',
    projectType: '',
    leadDesignerName: '',
    designFeeStructure: '',
    procurementFeeStructure: '',
    feeNotes: '',
    defaultMarkupPct: '15',
    markupMode: 'MARKUP',
    // Entered as a percentage (e.g. "7" = 7%) — converted to a fraction on submit.
    salesTaxRatePct: '7',
    taxBase: 'MERCH_ONLY',
    invoicePrefix: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { salesTaxRatePct, ...rest } = form;
    const res = await apiSend('/api/projects', 'POST', {
        ...rest,
        clientId: useNewClient ? '' : form.clientId,
        salesTaxRate: salesTaxRatePct ? Number(salesTaxRatePct) / 100 : 0,
      });

    setSaving(false);

    if (!res.ok) {
      setError(await apiError(res, 'Something went wrong.'));
      return;
    }

    const project = await res.json();
    router.push(`/app/projects/${project.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-brown">Client</label>
            {clients.length > 0 && (
              <button
                type="button"
                className="text-sm text-brown hover:text-gold"
                onClick={() => setUseNewClient(!useNewClient)}
              >
                {useNewClient ? 'Choose existing client' : '+ New client'}
              </button>
            )}
          </div>
          {useNewClient ? (
            <div className="space-y-3 rounded-md border border-taupe/40 p-3">
              <input
                className="input"
                required
                placeholder="Client name"
                value={form.newClientName}
                onChange={(e) => setForm({ ...form, newClientName: e.target.value })}
              />
              <input
                type="email"
                className="input"
                placeholder="Email (optional)"
                value={form.newClientEmail}
                onChange={(e) => setForm({ ...form, newClientEmail: e.target.value })}
              />
              <input
                className="input"
                placeholder="Phone (optional)"
                value={form.newClientPhone}
                onChange={(e) => setForm({ ...form, newClientPhone: e.target.value })}
              />
              <textarea
                className="input"
                rows={2}
                placeholder="Billing address (optional)"
                value={form.newClientAddress}
                onChange={(e) => setForm({ ...form, newClientAddress: e.target.value })}
              />
            </div>
          ) : (
            <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-brown">Project Name</label>
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
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETE">Complete</option>
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
          <label className="mb-1 block text-sm font-medium text-brown">Procurement Fee Structure</label>
          <input
            className="input"
            list="procurement-fee-structure-options"
            placeholder="e.g. Cost Plus"
            value={form.procurementFeeStructure}
            onChange={(e) => setForm({ ...form, procurementFeeStructure: e.target.value })}
          />
          <datalist id="procurement-fee-structure-options">
            {procurementFeeStructureOptions.map((f) => (
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
          <label className="mb-1 block text-sm font-medium text-brown">Sales Tax Rate (%)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.salesTaxRatePct}
            onChange={(e) => setForm({ ...form, salesTaxRatePct: e.target.value })}
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
          <textarea className="input" rows={2} value={form.feeNotes} onChange={(e) => setForm({ ...form, feeNotes: e.target.value })} />
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Creating…' : 'Create Project'}
      </button>
    </form>
  );
}
