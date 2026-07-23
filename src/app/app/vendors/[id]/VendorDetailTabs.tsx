'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VendorFormModal, { VendorRow } from '../VendorFormModal';
import VendorItemsPanel from '../VendorItemsPanel';
import AddItemToProjectModal from './AddItemToProjectModal';

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

  if (password) return <span className="font-mono text-sm">{password}</span>;
  return (
    <button className="text-sm text-gold hover:underline" onClick={reveal} disabled={loading}>
      {loading ? 'Loading…' : 'Show password'}
    </button>
  );
}

export default function VendorDetailTabs({
  vendor,
  offeringOptions,
  itemTypeOptions,
  activeProjects,
  canViewCredentials,
}: {
  vendor: VendorRow;
  offeringOptions: { id: string; name: string }[];
  itemTypeOptions: { id: string; category: string; name: string }[];
  activeProjects: { id: string; name: string }[];
  canViewCredentials: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<'info' | 'items'>('info');
  const [showEdit, setShowEdit] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemsRefreshKey, setItemsRefreshKey] = useState(0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 border-b border-taupe/40">
          <button
            onClick={() => setActive('info')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active === 'info' ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
            }`}
          >
            Contact & Showroom
          </button>
          <button
            onClick={() => setActive('items')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active === 'items' ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
            }`}
          >
            Linked Items
          </button>
        </div>
        <Link href="/app/vendors" className="text-sm text-brown/50 hover:text-brown">
          ← All Vendors
        </Link>
      </div>

      {active === 'info' && (
        <div className="card space-y-6 p-6">
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={() => setShowEdit(true)}>
              Edit Vendor
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Website</h3>
              {vendor.website ? (
                <a href={vendor.website} target="_blank" rel="noreferrer" className="text-sm text-gold hover:underline">
                  {vendor.website}
                </a>
              ) : (
                <p className="text-sm text-brown/40">—</p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Offerings</h3>
              <p className="text-sm text-brown/70">
                {vendor.offerings.length > 0 ? vendor.offerings.map((o) => o.name).join(', ') : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Rep Information</h3>
              <div className="space-y-1 text-sm text-brown/70">
                <p>{vendor.repName || '—'}</p>
                {vendor.repEmail && <p>{vendor.repEmail}</p>}
                {vendor.repPhone && <p>{vendor.repPhone}</p>}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Showroom Information</h3>
              <div className="space-y-1 text-sm text-brown/70">
                <p>{vendor.showroomName || '—'}</p>
                {vendor.showroomAddress && <p>{vendor.showroomAddress}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Trade / Retail</h3>
              <p className="text-sm text-brown/70">{vendor.accountType ? LABELS[vendor.accountType] : '—'}</p>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Stock / Custom</h3>
              <p className="text-sm text-brown/70">{vendor.productType ? LABELS[vendor.productType] : '—'}</p>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Price Range</h3>
              <p className="text-sm text-brown/70">{vendor.priceRange ? LABELS[vendor.priceRange] : '—'}</p>
            </div>
          </div>

          {vendor.notes && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Notes</h3>
              <p className="whitespace-pre-line text-sm text-brown/70">{vendor.notes}</p>
            </div>
          )}

          {canViewCredentials && (vendor.tradeAccountUsername || vendor.hasTradeAccountPassword || vendor.tradeAccountNotes) && (
            <div className="rounded-md border border-taupe/40 p-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Trade Account Credentials</h3>
              <div className="space-y-1 text-sm">
                {vendor.tradeAccountUsername && <p>{vendor.tradeAccountUsername}</p>}
                {vendor.hasTradeAccountPassword && <PasswordReveal vendorId={vendor.id} />}
                {vendor.tradeAccountNotes && <p className="text-brown/50">{vendor.tradeAccountNotes}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {active === 'items' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button className="btn-primary" onClick={() => setShowAddItem(true)}>
              + Add Item to Project
            </button>
          </div>
          <div className="card" key={itemsRefreshKey}>
            <VendorItemsPanel vendorId={vendor.id} />
          </div>
        </div>
      )}

      {showEdit && (
        <VendorFormModal
          vendor={vendor}
          offeringOptions={offeringOptions}
          canViewCredentials={canViewCredentials}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}

      {showAddItem && (
        <AddItemToProjectModal
          vendorId={vendor.id}
          activeProjects={activeProjects}
          itemTypeOptions={itemTypeOptions}
          onClose={() => setShowAddItem(false)}
          onCreated={() => {
            setShowAddItem(false);
            setItemsRefreshKey((k) => k + 1);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
