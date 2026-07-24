'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPercent, formatPercentFromFraction } from '@/lib/money';
import { apiError, apiSend } from '@/lib/apiClient';

export interface ProcurementFeeData {
  procurementFeeStructure: string | null;
  defaultMarkupPct: string;
  markupMode: string;
  salesTaxRate: string;
  taxBase: string;
}

export default function ProcurementFeeSection({
  projectId,
  data,
  procurementFeeStructureOptions,
}: {
  projectId: string;
  data: ProcurementFeeData;
  procurementFeeStructureOptions: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    procurementFeeStructure: data.procurementFeeStructure ?? '',
    defaultMarkupPct: data.defaultMarkupPct,
    markupMode: data.markupMode,
    // Entered as a percentage (e.g. "7" = 7%) — converted to/from the stored fraction.
    salesTaxRatePct: String(Number(data.salesTaxRate) * 100),
    taxBase: data.taxBase,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { salesTaxRatePct, ...rest } = form;
    const res = await apiSend(`/api/projects/${projectId}`, 'PATCH', {
        ...rest,
        salesTaxRate: salesTaxRatePct ? Number(salesTaxRatePct) / 100 : 0,
      });

    setSaving(false);

    if (!res.ok) {
      setError(await apiError(res, 'Something went wrong.'));
      return;
    }

    setEditing(false);
    router.refresh();
  }

  return (
    <div className="card mb-6 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-taupe">Procurement Fees</h2>
        {!editing && (
          <button className="text-sm text-brown hover:text-gold" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <select
                className="input"
                value={form.markupMode}
                onChange={(e) => setForm({ ...form, markupMode: e.target.value })}
              >
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
              <label className="mb-1 block text-sm font-medium text-brown">Sales Tax Base</label>
              <select className="input" value={form.taxBase} onChange={(e) => setForm({ ...form, taxBase: e.target.value })}>
                <option value="MERCH_ONLY">Merchandise only</option>
                <option value="MERCH_PLUS_SHIPPING">Merchandise + shipping</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-brown/50">Procurement Fee Structure</dt>
            <dd className="font-medium">{data.procurementFeeStructure || '—'}</dd>
          </div>
          <div>
            <dt className="text-brown/50">Default Markup</dt>
            <dd className="font-medium">
              {formatPercent(data.defaultMarkupPct)} ({data.markupMode.toLowerCase()})
            </dd>
          </div>
          <div>
            <dt className="text-brown/50">Sales Tax</dt>
            <dd className="font-medium">
              {formatPercentFromFraction(data.salesTaxRate)} on{' '}
              {data.taxBase === 'MERCH_PLUS_SHIPPING' ? 'merch + shipping' : 'merch only'}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
