'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/money';
import type { Decimal } from 'decimal.js';

export interface VoidedInvoiceOption {
  id: string;
  invoiceNumber: string;
  total: Decimal.Value;
}

/**
 * Voided invoices stay viewable (a preview of exactly what was sent, or
 * would have been) but can never be sent again — collapsing them into a
 * dropdown keeps a project's invoice list from filling up with dead
 * entries once a few invoices have been corrected.
 */
export default function VoidedInvoicesDropdown({ invoices }: { invoices: VoidedInvoiceOption[] }) {
  const [selectedId, setSelectedId] = useState(invoices[0]?.id ?? '');
  if (invoices.length === 0) return null;

  const selected = invoices.find((i) => i.id === selectedId) ?? invoices[0];

  return (
    <div className="card p-4 opacity-80">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-taupe">Voided ({invoices.length})</p>
        <select
          className="input w-auto py-1 text-sm"
          value={selected.id}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.invoiceNumber}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-serif font-medium text-brown line-through">{selected.invoiceNumber}</span>
        <span className="tabular-nums text-brown/70">{formatMoney(selected.total)}</span>
        <a
          className="font-medium text-gold hover:underline"
          href={`/api/invoices/${selected.id}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          View PDF
        </a>
      </div>
    </div>
  );
}
