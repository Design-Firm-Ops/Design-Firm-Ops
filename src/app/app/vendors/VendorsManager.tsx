'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import VendorFormModal, { VendorRow } from './VendorFormModal';
import VendorItemsPanel from './VendorItemsPanel';

type SortKey = 'name' | 'accountType' | 'productType' | 'priceRange';

const LABELS: Record<string, string> = {
  TRADE: 'Trade',
  RETAIL: 'Retail',
  BOTH: 'Both',
  STOCK: 'Stock',
  CUSTOM: 'Custom',
  LOW: 'Low',
  MID: 'Mid',
  HIGH: 'High',
};

const OFFERINGS = ['FURNITURE', 'OUTDOOR', 'RUGS', 'PILLOWS', 'DECOR', 'MIRRORS', 'LAMPS', 'BEDDING'];

function PasswordReveal({ vendorId }: { vendorId: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    const res = await fetch(`/api/vendors/${vendorId}/credentials`);
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setPassword(data.password || '(no password stored)');
    }
  }

  if (password) return <span className="font-mono text-xs">{password}</span>;
  return (
    <button className="text-xs text-gold hover:underline" onClick={reveal} disabled={loading}>
      {loading ? 'Loading…' : 'Show password'}
    </button>
  );
}

export default function VendorsManager({
  initialVendors,
  canViewCredentials,
}: {
  initialVendors: VendorRow[];
  canViewCredentials: boolean;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VendorRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [offeringFilters, setOfferingFilters] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleOfferingFilter(offering: string) {
    setOfferingFilters((prev) => {
      const next = new Set(prev);
      if (next.has(offering)) next.delete(offering);
      else next.add(offering);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (offeringFilters.size === 0) return initialVendors;
    return initialVendors.filter((v) => v.offerings.some((o) => offeringFilters.has(o)));
  }, [initialVendors, offeringFilters]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = (a[sortKey] ?? '').toString().toLowerCase();
      const bv = (b[sortKey] ?? '').toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return '';
    return sortAsc ? ' ▲' : ' ▼';
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/vendors/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? 'Failed to delete vendor.');
      return;
    }

    setPendingDelete(null);
    router.refresh();
  }

  const columnCount = canViewCredentials ? 8 : 7;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-brown/50">Filter by offering:</span>
          {OFFERINGS.map((o) => (
            <button
              key={o}
              onClick={() => toggleOfferingFilter(o)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                offeringFilters.has(o)
                  ? 'border-gold bg-gold/90 text-brown'
                  : 'border-taupe/40 text-brown/60 hover:bg-taupe/10'
              }`}
            >
              {o.charAt(0) + o.slice(1).toLowerCase()}
            </button>
          ))}
          {offeringFilters.size > 0 && (
            <button className="text-xs text-brown/50 hover:text-brown" onClick={() => setOfferingFilters(new Set())}>
              Clear
            </button>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditingVendor(null);
            setShowForm(true);
          }}
        >
          New Vendor
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-semibold uppercase tracking-wide text-brown/60">
            <tr>
              <th className="px-4 py-3" />
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort('name')}>
                Vendor{sortIndicator('name')}
              </th>
              <th className="px-4 py-3">Rep</th>
              <th className="px-4 py-3">Showroom</th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort('accountType')}>
                Trade/Retail{sortIndicator('accountType')}
              </th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort('priceRange')}>
                Price{sortIndicator('priceRange')}
              </th>
              <th className="px-4 py-3">Offerings</th>
              {canViewCredentials && <th className="px-4 py-3">Trade Login</th>}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {sorted.map((vendor) => (
              <Fragment key={vendor.id}>
                <tr className="hover:bg-taupe/5">
                  <td className="px-4 py-3">
                    <button
                      className="text-brown/40 hover:text-brown"
                      title="Show previously used items"
                      onClick={() => setExpandedId(expandedId === vendor.id ? null : vendor.id)}
                    >
                      {expandedId === vendor.id ? '▾' : '▸'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {vendor.website ? (
                      <a
                        href={vendor.website}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brown hover:text-gold"
                      >
                        {vendor.name}
                      </a>
                    ) : (
                      <span className="font-medium text-brown">{vendor.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-brown/70">
                    {vendor.repName || vendor.repEmail || vendor.repPhone ? (
                      <div className="space-y-0.5">
                        {vendor.repName && <p>{vendor.repName}</p>}
                        {vendor.repEmail && <p className="text-brown/50">{vendor.repEmail}</p>}
                        {vendor.repPhone && <p className="text-brown/50">{vendor.repPhone}</p>}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-brown/70">
                    {vendor.showroomName || vendor.showroomAddress ? (
                      <div className="space-y-0.5">
                        {vendor.showroomName && <p>{vendor.showroomName}</p>}
                        {vendor.showroomAddress && <p className="text-brown/50">{vendor.showroomAddress}</p>}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-brown/70">{vendor.accountType ? LABELS[vendor.accountType] : '—'}</td>
                  <td className="px-4 py-3 text-brown/70">{vendor.priceRange ? LABELS[vendor.priceRange] : '—'}</td>
                  <td className="px-4 py-3 text-xs text-brown/70">
                    {vendor.offerings.length > 0
                      ? vendor.offerings.map((o) => o.charAt(0) + o.slice(1).toLowerCase()).join(', ')
                      : '—'}
                  </td>
                  {canViewCredentials && (
                    <td className="px-4 py-3 text-xs">
                      {vendor.tradeAccountUsername || vendor.tradeAccountNotes || vendor.hasTradeAccountPassword ? (
                        <div className="space-y-1">
                          {vendor.tradeAccountUsername && <p>{vendor.tradeAccountUsername}</p>}
                          {vendor.hasTradeAccountPassword && <PasswordReveal vendorId={vendor.id} />}
                          {vendor.tradeAccountNotes && <p className="text-brown/50">{vendor.tradeAccountNotes}</p>}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <button
                      className="mr-3 text-sm text-brown hover:text-gold"
                      onClick={() => {
                        setEditingVendor(vendor);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-sm text-red-700 hover:text-red-900"
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDelete(vendor);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {expandedId === vendor.id && (
                  <tr>
                    <td colSpan={columnCount} className="bg-taupe/5">
                      <VendorItemsPanel vendorId={vendor.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-8 text-center text-brown/50">
                  No vendors match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <VendorFormModal
          vendor={editingVendor}
          canViewCredentials={canViewCredentials}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete vendor?"
        message={deleteError ?? `This will permanently delete "${pendingDelete?.name}". This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
