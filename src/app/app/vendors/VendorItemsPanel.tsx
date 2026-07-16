'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface VendorItemRow {
  id: string;
  tag: string;
  name: string;
  category: string;
  status: string;
  project: { id: string; name: string };
}

export default function VendorItemsPanel({ vendorId }: { vendorId: string }) {
  const [items, setItems] = useState<VendorItemRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/vendors/${vendorId}/items`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setItems(data);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (items === null) {
    return <p className="px-4 py-3 text-xs text-brown/50">Loading previously used items…</p>;
  }

  if (items.length === 0) {
    return <p className="px-4 py-3 text-xs text-brown/50">No line items have used this vendor yet.</p>;
  }

  return (
    <div className="px-4 py-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brown/60">
        Previously Used Items ({items.length})
      </h4>
      <table className="min-w-full text-xs">
        <thead className="text-left text-brown/50">
          <tr>
            <th className="py-1 pr-4">Tag</th>
            <th className="py-1 pr-4">Item</th>
            <th className="py-1 pr-4">Category</th>
            <th className="py-1 pr-4">Status</th>
            <th className="py-1 pr-4">Project</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-taupe/20">
              <td className="py-1.5 pr-4">{item.tag}</td>
              <td className="py-1.5 pr-4">{item.name}</td>
              <td className="py-1.5 pr-4">{item.category}</td>
              <td className="py-1.5 pr-4">{item.status}</td>
              <td className="py-1.5 pr-4">
                <Link href={`/app/projects/${item.project.id}`} className="text-brown hover:text-gold">
                  {item.project.name}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
