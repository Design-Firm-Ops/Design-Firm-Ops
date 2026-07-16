'use client';

import { useState } from 'react';

export interface ProjectTab {
  key: string;
  label: string;
  content: React.ReactNode;
}

/** Renders only the tabs the caller passes in — hide a tab entirely by omitting it (permission gating). */
export default function ProjectTabs({ tabs }: { tabs: ProjectTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  if (tabs.length === 0) {
    return <div className="card p-8 text-center text-brown/50">No tabs are visible to your role.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-taupe/40">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab?.key === tab.key ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{activeTab?.content}</div>
    </div>
  );
}
