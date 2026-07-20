'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

export interface ResourceRow {
  id: string;
  folder: string;
  filename: string;
  url: string | null;
  uploadedAt: string;
  uploadedByName: string | null;
}

export default function FolderView({ folder, files, query }: { folder: string; files: ResourceRow[]; query: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ResourceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visible = query.trim()
    ? files.filter((f) => f.filename.toLowerCase().includes(query.trim().toLowerCase()))
    : files;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);
    body.append('folder', folder);

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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="btn-primary cursor-pointer">
          {uploading ? 'Uploading…' : 'Upload File'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Uploaded By</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {visible.map((r) => (
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
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brown/50">
                  {query.trim() ? 'No files match your search.' : 'No files uploaded yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
