'use client';

import { useState } from 'react';

export default function AdminTabs({
  storageContent,
  vendorsContent,
  usersContent,
  permissionsContent,
  isAdmin,
}: {
  storageContent: React.ReactNode;
  vendorsContent: React.ReactNode;
  usersContent: React.ReactNode;
  permissionsContent: React.ReactNode;
  isAdmin: boolean;
}) {
  const tabs = [
    { key: 'storage', label: 'Storage', content: storageContent },
    { key: 'vendors', label: 'Vendors', content: vendorsContent },
    ...(isAdmin ? [{ key: 'users', label: 'Users', content: usersContent }] : []),
    ...(isAdmin ? [{ key: 'permissions', label: 'Permissions', content: permissionsContent }] : []),
  ];

  const [active, setActive] = useState(tabs[0].key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-taupe/40">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab.key === tab.key ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{activeTab.content}</div>
    </div>
  );
}
