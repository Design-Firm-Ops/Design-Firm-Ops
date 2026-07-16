'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

interface ResourceRow {
  id: string;
  folder: string;
  filename: string;
  url: string | null;
  uploadedAt: string;
  uploadedByName: string | null;
}

export default function StorageCenter({ initialResources }: { initialResources: ResourceRow[] }) {
  const router = useRouter();
  const [folder, setFolder] = useState('Templates');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ResourceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const folders = useMemo(() => Array.from(new Set(initialResources.map((r) => r.folder))).sort(), [initialResources]);
  const grouped = useMemo(() => {
    const map = new Map<string, ResourceRow[]>();
    for (const r of initialResources) {
      const list = map.get(r.folder) ?? [];
      list.push(r);
      map.set(r.folder, list);
    }
    return map;
  }, [initialResources]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !folder.trim()) return;

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);
    body.append('folder', folder.trim());

    const res = await fetch('/api/resources', { method: 'POST', body });
    setUploading(false);
    e.target.value = '';

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Upload failed.');
      return;
    }

    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    await fetch(`/api/resources/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          className="input w-auto"
          list="resource-folder-options"
          placeholder="Folder (e.g. Templates)"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
        <datalist id="resource-folder-options">
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <label className="btn-primary cursor-pointer">
          {uploading ? 'Uploading…' : 'Upload File'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading || !folder.trim()} />
        </label>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>

      {folders.length === 0 && <p className="text-brown/50">No files uploaded yet.</p>}

      <div className="space-y-6">
        {folders.map((f) => (
          <div key={f}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brown/60">{f}</h2>
            <div className="card overflow-x-auto">
              <table className="min-w-full divide-y divide-taupe/30 text-sm">
                <thead className="bg-taupe/10 text-left text-xs font-semibold uppercase tracking-wide text-brown/60">
                  <tr>
                    <th className="px-4 py-3">Filename</th>
                    <th className="px-4 py-3">Uploaded By</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-taupe/20">
                  {(grouped.get(f) ?? []).map((r) => (
                    <tr key={r.id} className="hover:bg-taupe/5">
                      <td className="px-4 py-3">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-brown hover:text-gold">
                            {r.filename}
                          </a>
                        ) : (
                          <span className="font-medium text-brown/50">{r.filename}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-brown/70">{r.uploadedByName ?? '—'}</td>
                      <td className="px-4 py-3 text-brown/70">{new Date(r.uploadedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-sm text-red-700 hover:text-red-900" onClick={() => setPendingDelete(r)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete file?"
        message={`This will permanently delete "${pendingDelete?.filename}". This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
