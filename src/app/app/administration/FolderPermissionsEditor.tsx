'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiSend } from '@/lib/apiClient';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function FolderPermissionsEditor({
  folderName,
  allUsers,
  allowedUserIds,
}: {
  folderName: string;
  allUsers: UserOption[];
  allowedUserIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(allowedUserIds));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await apiSend('/api/resource-folders', 'PUT', { name: folderName, allowedUserIds: Array.from(selected) });
    setSaving(false);
    if (res.ok) {
      setMessage('Saved.');
      router.refresh();
    } else {
      setMessage('Could not save.');
    }
  }

  return (
    <details className="mb-4 rounded-md border border-taupe/40 p-4">
      <summary className="cursor-pointer text-sm font-medium text-brown">Folder Permissions</summary>
      <p className="mb-3 mt-2 text-xs text-brown/50">
        Leave everyone unchecked to let all teammates see this folder. Check specific people to restrict it to just
        them (admins can always see every folder).
      </p>
      <div className="mb-3 space-y-1">
        {allUsers.map((u) => (
          <label key={u.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
            {u.name} <span className="text-xs text-brown/50">({u.email})</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary py-1.5 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Access'}
        </button>
        {message && <span className="text-xs text-brown/60">{message}</span>}
      </div>
    </details>
  );
}
