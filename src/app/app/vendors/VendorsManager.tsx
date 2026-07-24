'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import VendorFormModal, { VendorRow } from './VendorFormModal';
import OfferingManager, { OfferingRow } from './OfferingManager';
import { apiError, apiSend } from '@/lib/apiClient';

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

export default function VendorsManager({
  initialVendors,
  offeringOptions,
  canViewCredentials,
}: {
  initialVendors: VendorRow[];
  offeringOptions: OfferingRow[];
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
  const [showOfferingManager, setShowOfferingManager] = useState(false);

  function toggleOfferingFilter(offeringId: string) {
    setOfferingFilters((prev) => {
      const next = new Set(prev);
      if (next.has(offeringId)) next.delete(offeringId);
      else next.add(offeringId);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (offeringFilters.size === 0) return initialVendors;
    return initialVendors.filter((v) => v.offerings.some((o) => offeringFilters.has(o.id)));
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

    const res = await apiSend(`/api/vendors/${pendingDelete.id}`, 'DELETE');
    setDeleting(false);

    if (!res.ok) {
      setDeleteError(await apiError(res, 'Failed to delete vendor.'));
      return;
    }

    setPendingDelete(null);
    router.refresh();
  }

  const columnCount = canViewCredentials ? 7 : 6;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.24em] text-taupe">Filter by offering:</span>
          {offeringOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => toggleOfferingFilter(o.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                offeringFilters.has(o.id)
                  ? 'border-brown bg-brown text-cream'
                  : 'border-taupe/40 text-brown/60 hover:bg-taupe/10'
              }`}
            >
              {o.name}
            </button>
          ))}
          {offeringFilters.size > 0 && (
            <button className="text-xs text-brown/50 hover:text-brown" onClick={() => setOfferingFilters(new Set())}>
              Clear
            </button>
          )}
          <button className="text-xs text-brown/50 underline hover:text-brown" onClick={() => setShowOfferingManager(true)}>
            Manage categories
          </button>
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
          <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort('name')}>
                Vendor{sortIndicator('name')}
              </th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Rep</th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort('accountType')}>
                Trade/Retail{sortIndicator('accountType')}
              </th>
              <th className="cursor-pointer select-none px-4 py-3" onClick={() => toggleSort('priceRange')}>
                Price{sortIndicator('priceRange')}
              </th>
              <th className="px-4 py-3">Offerings</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {sorted.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3">
                  <Link href={`/app/vendors/${vendor.id}`} className="font-medium text-brown hover:text-gold">
                    {vendor.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">
                  {vendor.website ? (
                    <a href={vendor.website} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                      Website
                    </a>
                  ) : (
                    <span className="text-brown/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-brown/70">{vendor.repName || '—'}</td>
                <td className="px-4 py-3 text-brown/70">{vendor.accountType ? LABELS[vendor.accountType] : '—'}</td>
                <td className="px-4 py-3 text-brown/70">{vendor.priceRange ? LABELS[vendor.priceRange] : '—'}</td>
                <td className="px-4 py-3 text-xs text-brown/70">
                  {vendor.offerings.length > 0 ? vendor.offerings.map((o) => o.name).join(', ') : '—'}
                </td>
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
          offeringOptions={offeringOptions}
          canViewCredentials={canViewCredentials}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}

      {showOfferingManager && (
        <OfferingManager offerings={offeringOptions} onClose={() => setShowOfferingManager(false)} />
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
