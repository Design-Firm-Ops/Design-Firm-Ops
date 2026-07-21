'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RoleDefaults {
  designerCanViewFinancials: boolean;
  designerCanViewClientContact: boolean;
  designerCanViewDocumentsPresentations: boolean;
  designerCanViewContracts: boolean;
  designerCanViewInvoices: boolean;
  designerCanViewProcurement: boolean;
  designerCanViewVendorCredentials: boolean;
}

type PermKey =
  | 'financials'
  | 'clientContact'
  | 'documentsPresentations'
  | 'contracts'
  | 'invoices'
  | 'procurement'
  | 'vendorCredentials';

const PERMS: { key: PermKey; roleKey: keyof RoleDefaults; label: string; description: string }[] = [
  {
    key: 'financials',
    roleKey: 'designerCanViewFinancials',
    label: 'Financial Summary',
    description: 'Merchandise invoiced/paid/outstanding and design fee billed/paid/outstanding on the project overview.',
  },
  {
    key: 'clientContact',
    roleKey: 'designerCanViewClientContact',
    label: 'Client Contact Info',
    description: "Client's email, phone, and billing address on the project overview.",
  },
  {
    key: 'documentsPresentations',
    roleKey: 'designerCanViewDocumentsPresentations',
    label: 'Documents and Presentations tab',
    description: 'Presentations, vendor invoices, and other project files.',
  },
  {
    key: 'contracts',
    roleKey: 'designerCanViewContracts',
    label: 'Contract tab',
    description: 'Signed contracts for the project.',
  },
  {
    key: 'invoices',
    roleKey: 'designerCanViewInvoices',
    label: 'Invoices tab',
    description: 'Merchandise invoices and payments.',
  },
  {
    key: 'procurement',
    roleKey: 'designerCanViewProcurement',
    label: 'Procurement tab',
    description: 'The line-item ordering spreadsheet, plus markup and sales tax defaults.',
  },
  {
    key: 'vendorCredentials',
    roleKey: 'designerCanViewVendorCredentials',
    label: 'Vendor Trade Account Credentials',
    description: 'Usernames and passwords stored on the Vendors page.',
  },
];

type OverrideValue = boolean | null;
type OverrideMap = Record<string, Partial<Record<PermKey, OverrideValue>>>;

interface DesignerRow {
  id: string;
  name: string;
  email: string;
}

export default function PermissionsManager({
  initialRoleDefaults,
  designers,
  initialOverrides,
}: {
  initialRoleDefaults: RoleDefaults;
  designers: DesignerRow[];
  initialOverrides: OverrideMap;
}) {
  const router = useRouter();
  const [roleDefaults, setRoleDefaults] = useState(initialRoleDefaults);
  const [savingRole, setSavingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [overrides, setOverrides] = useState(initialOverrides);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  async function handleSaveRoleDefaults(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    setRoleError(null);
    setRoleMessage(null);

    const res = await fetch('/api/settings/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleDefaults),
    });

    setSavingRole(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRoleError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    setRoleMessage('Defaults saved.');
    router.refresh();
  }

  async function setOverride(userId: string, key: PermKey, value: OverrideValue) {
    const nextForUser = { ...(overrides[userId] ?? {}), [key]: value };
    setOverrides({ ...overrides, [userId]: nextForUser });
    setSavingUserId(userId);
    setOverrideError(null);

    const res = await fetch(`/api/users/${userId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextForUser),
    });

    setSavingUserId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setOverrideError(data?.error ? JSON.stringify(data.error) : 'Could not save that override.');
      return;
    }

    router.refresh();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <form onSubmit={handleSaveRoleDefaults} className="card space-y-4 p-6">
        <div>
          <h2 className="text-lg font-medium text-brown">Default for Designers</h2>
          <p className="text-sm text-brown/60">
            Administrators always see everything. These are the starting permissions for the Designer role — pin a
            different value for one specific person below.
          </p>
        </div>

        <div className="divide-y divide-taupe/20">
          {PERMS.map((p) => (
            <label key={p.key} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={roleDefaults[p.roleKey]}
                onChange={(e) => setRoleDefaults({ ...roleDefaults, [p.roleKey]: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-brown">{p.label}</span>
                <span className="block text-xs text-brown/50">{p.description}</span>
              </span>
            </label>
          ))}
        </div>

        {roleError && <p className="text-sm text-red-700">{roleError}</p>}
        {roleMessage && <p className="text-sm text-green-700">{roleMessage}</p>}

        <button type="submit" className="btn-primary" disabled={savingRole}>
          {savingRole ? 'Saving…' : 'Save Defaults'}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-brown">Per-Person Overrides</h2>
        <p className="mb-4 text-sm text-brown/60">
          Pin a permission for one specific person, regardless of the default above — e.g. one designer can see
          pricing while another can&apos;t.
        </p>

        {designers.length === 0 ? (
          <p className="text-sm text-brown/50">No Designer-role teammates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-taupe/30 text-sm">
              <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">Teammate</th>
                  {PERMS.map((p) => (
                    <th key={p.key} className="whitespace-nowrap px-3 py-2">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-taupe/20">
                {designers.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-brown">{d.name}</td>
                    {PERMS.map((p) => {
                      const value = overrides[d.id]?.[p.key] ?? null;
                      return (
                        <td key={p.key} className="px-3 py-2">
                          <select
                            className="input py-1 text-xs"
                            value={value === null ? 'default' : value ? 'yes' : 'no'}
                            disabled={savingUserId === d.id}
                            onChange={(e) => {
                              const v = e.target.value === 'default' ? null : e.target.value === 'yes';
                              setOverride(d.id, p.key, v);
                            }}
                          >
                            <option value="default">Default ({roleDefaults[p.roleKey] ? 'Yes' : 'No'})</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {overrideError && <p className="mt-3 text-sm text-red-700">{overrideError}</p>}
      </div>
    </div>
  );
}
