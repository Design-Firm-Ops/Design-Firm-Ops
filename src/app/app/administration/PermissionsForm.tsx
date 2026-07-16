'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PermissionsData {
  designerCanViewFinancials: boolean;
  designerCanViewClientContact: boolean;
  designerCanViewDocumentsPresentations: boolean;
  designerCanViewContracts: boolean;
  designerCanViewInvoices: boolean;
  designerCanViewProcurement: boolean;
  designerCanViewVendorCredentials: boolean;
}

const FIELDS: { key: keyof PermissionsData; label: string; description: string }[] = [
  {
    key: 'designerCanViewFinancials',
    label: 'Financial Summary',
    description: 'Merchandise invoiced/paid/outstanding and design fee billed/paid/outstanding on the project overview.',
  },
  {
    key: 'designerCanViewClientContact',
    label: 'Client Contact Info',
    description: "Client's email, phone, and billing address on the project overview.",
  },
  {
    key: 'designerCanViewDocumentsPresentations',
    label: 'Documents and Presentations tab',
    description: 'Presentations, vendor invoices, and other project files.',
  },
  { key: 'designerCanViewContracts', label: 'Contract tab', description: 'Signed contracts for the project.' },
  { key: 'designerCanViewInvoices', label: 'Invoices tab', description: 'Merchandise invoices and payments.' },
  { key: 'designerCanViewProcurement', label: 'Procurement tab', description: 'The line-item ordering spreadsheet.' },
  {
    key: 'designerCanViewVendorCredentials',
    label: 'Vendor Trade Account Credentials',
    description: 'Usernames and passwords stored on the Vendors page.',
  },
];

export default function PermissionsForm({ initialSettings }: { initialSettings: PermissionsData }) {
  const router = useRouter();
  const [form, setForm] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await fetch('/api/settings/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    setMessage('Permissions saved.');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-brown">Designer Role Visibility</h2>
        <p className="text-sm text-brown/60">
          Administrators always see everything. These toggles control what the Designer role can see.
        </p>
      </div>

      <div className="divide-y divide-taupe/20">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex items-start gap-3 py-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium text-brown">{field.label}</span>
              <span className="block text-xs text-brown/50">{field.description}</span>
            </span>
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save Permissions'}
      </button>
    </form>
  );
}
