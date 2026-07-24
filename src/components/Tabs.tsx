'use client';

import { useState } from 'react';

export interface Tab {
  key: string;
  label: string;
  content: React.ReactNode;
}

/**
 * The app's tab strip. Renders only the tabs the caller passes in — hide a
 * tab entirely by omitting it (that's how permission gating works), rather
 * than rendering it disabled.
 */
export default function Tabs({
  tabs,
  emptyMessage = 'No tabs are visible to your role.',
  /** Rendered at the right end of the tab strip (e.g. a "← All Vendors" link). */
  action,
}: {
  tabs: Tab[];
  emptyMessage?: string;
  action?: React.ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  if (tabs.length === 0) {
    return <div className="card p-8 text-center text-brown/50">{emptyMessage}</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 border-b border-taupe/40" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab?.key === tab.key}
              onClick={() => setActive(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab?.key === tab.key ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {action}
      </div>
      <div>{activeTab?.content}</div>
    </div>
  );
}
