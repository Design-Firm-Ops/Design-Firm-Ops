'use client';

import { useState } from 'react';

export default function BusinessDevTabs({
  leadsContent,
  referralPartnersContent,
}: {
  leadsContent: React.ReactNode;
  referralPartnersContent: React.ReactNode;
}) {
  const [active, setActive] = useState<'leads' | 'partners'>('leads');

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-taupe/40">
        <button
          onClick={() => setActive('leads')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === 'leads' ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
          }`}
        >
          Leads
        </button>
        <button
          onClick={() => setActive('partners')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === 'partners' ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
          }`}
        >
          Referral Partners
        </button>
      </div>
      <div>{active === 'leads' ? leadsContent : referralPartnersContent}</div>
    </div>
  );
}
