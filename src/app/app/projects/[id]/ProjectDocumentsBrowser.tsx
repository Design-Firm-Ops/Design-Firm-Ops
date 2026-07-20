'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import FolderIcon from '../../administration/FolderIcon';

export interface DocumentRow {
  id: string;
  type: string;
  filename: string;
  folder: string | null;
  url: string | null;
  uploadedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  PRESENTATION: 'Presentation',
  VENDOR_INVOICE: 'Vendor Invoice',
  OTHER: 'Other',
};

export default function ProjectDocumentsBrowser({
  projectId,
  documents,
  defaultFolders,
}: {
  projectId: string;
  documents: DocumentRow[];
  defaultFolders: string[];
}) {
  const router = useRouter();
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [type, setType] = useState('PRESENTATION');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const folders = useMemo(() => {
    const names = new Set(defaultFolders);
    for (const d of documents) {
      if (d.folder) names.add(d.folder);
    }
    return Array.from(names);
  }, [defaultFolders, documents]);

  const filesByFolder = useMemo(() => {
    const map = new Map<string, DocumentRow[]>();
    for (const d of documents) {
      const folder = d.folder ?? 'Uncategorized';
      const list = map.get(folder) ?? [];
      list.push(d);
      map.set(folder, list);
    }
    return map;
  }, [documents]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !openFolder) return;

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);
    body.append('projectId', projectId);
    body.append('type', type);
    body.append('folder', openFolder);

    const res = await fetch('/api/documents', { method: 'POST', body });
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
    await fetch(`/api/documents/${pendingDelete.id}`, { method: 'DELETE' });
    setDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }

  if (openFolder) {
    const files = filesByFolder.get(openFolder) ?? [];
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm">
          <button className="text-brown/60 hover:text-brown" onClick={() => setOpenFolder(null)}>
            Documents and Presentations
          </button>
          <span className="text-brown/30">/</span>
          <span className="font-medium text-brown">{openFolder}</span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="btn-primary cursor-pointer">
            {uploading ? 'Uploading…' : 'Upload File'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>

        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-taupe/30 text-sm">
            <thead className="bg-taupe/10 text-left text-xs font-semibold uppercase tracking-wide text-brown/60">
              <tr>
                <th className="px-4 py-3">Filename</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe/20">
              {files.map((doc) => (
                <tr key={doc.id} className="hover:bg-taupe/5">
                  <td className="px-4 py-3">
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="font-medium text-brown hover:text-gold">
                        {doc.filename}
                      </a>
                    ) : (
                      <span className="font-medium text-brown/50">{doc.filename}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brown/70">{TYPE_LABELS[doc.type] ?? doc.type}</td>
                  <td className="px-4 py-3 text-brown/70">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-sm text-red-700 hover:text-red-900" onClick={() => setPendingDelete(doc)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-brown/50">
                    No files in this folder yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ConfirmDialog
          open={!!pendingDelete}
          title="Delete document?"
          message={`This will permanently delete "${pendingDelete?.filename}". This cannot be undone.`}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-secondary" onClick={() => setShowNewFolder(true)}>
          + New Folder
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {folders.map((folder) => (
          <button
            key={folder}
            onClick={() => setOpenFolder(folder)}
            className="card flex flex-col items-center gap-2 p-4 text-center hover:bg-taupe/5"
          >
            <FolderIcon className="h-10 w-10 text-gold" />
            <span className="text-sm font-medium text-brown">{folder}</span>
            <span className="text-xs text-brown/50">
              {(filesByFolder.get(folder) ?? []).length} file{(filesByFolder.get(folder) ?? []).length === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>

      {showNewFolder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form
            className="card w-full max-w-sm space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newFolderName.trim()) return;
              setOpenFolder(newFolderName.trim());
              setShowNewFolder(false);
              setNewFolderName('');
            }}
          >
            <h2 className="text-lg font-semibold text-brown">New Folder</h2>
            <input
              className="input"
              required
              autoFocus
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowNewFolder(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
