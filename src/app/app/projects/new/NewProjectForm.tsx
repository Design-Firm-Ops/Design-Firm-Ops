'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProjectForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? '',
    name: '',
    projectAddress: '',
    status: 'LEAD',
    startDate: '',
    feeStructure: 'COST_PLUS',
    feeNotes: '',
    defaultMarkupPct: '15',
    markupMode: 'MARKUP',
    salesTaxRate: '0.07',
    taxBase: 'MERCH_ONLY',
    invoicePrefix: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    const project = await res.json();
    router.push(`/app/projects/${project.id}`);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-brown/70">
          You need at least one client before creating a project.{' '}
          <Link href="/app/clients" className="text-gold underline">
            Add a client
          </Link>{' '}
          first.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-brown">Client</label>
          <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
          <label className="mb-1 block text-sm font-medium text-brown">Fee Structure</label>
          <select
            className="input"
            value={form.feeStructure}
            onChange={(e) => setForm({ ...form, feeStructure: e.target.value })}
          >
            <option value="FLAT_FEE">Flat Fee</option>
            <option value="HOURLY">Hourly</option>
            <option value="COST_PLUS">Cost Plus</option>
            <option value="HYBRID">Hybrid</option>
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
