'use client';

import { useState } from 'react';

const TABS = ['Items', 'Invoices', 'Contracts', 'Documents', 'Payments'] as const;
export type TabName = (typeof TABS)[number];

export default function ProjectTabs({
  panels,
}: {
  panels: Record<TabName, React.ReactNode>;
}) {
  const [active, setActive] = useState<TabName>('Items');

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-taupe/40">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active === tab ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div>{panels[active]}</div>
    </div>
  );
}
