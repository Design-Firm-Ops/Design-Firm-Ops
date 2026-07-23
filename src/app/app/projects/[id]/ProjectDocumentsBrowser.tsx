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

export interface FolderRow {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<string, string> = {
  PRESENTATION: 'Presentation',
  VENDOR_INVOICE: 'Vendor Invoice',
  OTHER: 'Other',
};

export default function ProjectDocumentsBrowser({
  projectId,
  documents,
  folders,
}: {
  projectId: string;
  documents: DocumentRow[];
  folders: FolderRow[];
}) {
  const router = useRouter();
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [type, setType] = useState('PRESENTATION');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<FolderRow | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

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

  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !openFolder) return;

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);
    body.append('projectId', projectId);
    body.append('type', type);
    body.append('folder', openFolder.name);

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

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    setFolderError(null);

    const res = await fetch('/api/document-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: newFolderName.trim() }),
    });
    setCreatingFolder(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setFolderError(data?.error ?? 'Could not create folder.');
      return;
    }

    const folder = await res.json();
    setShowNewFolder(false);
    setNewFolderName('');
    setOpenFolderId(folder.id);
    router.refresh();
  }

  async function handleRenameFolder(folderId: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    await fetch(`/api/document-folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingId(null);
    router.refresh();
  }

  async function confirmDeleteFolder() {
    if (!pendingDeleteFolder) return;
    setDeletingFolder(true);
    await fetch(`/api/document-folders/${pendingDeleteFolder.id}`, { method: 'DELETE' });
    setDeletingFolder(false);
    setPendingDeleteFolder(null);
    if (openFolderId === pendingDeleteFolder.id) setOpenFolderId(null);
    router.refresh();
  }

  if (openFolder) {
    const files = filesByFolder.get(openFolder.name) ?? [];
    return (
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm">
          <button className="text-brown/60 hover:text-brown" onClick={() => setOpenFolderId(null)}>
            Project Documents
          </button>
          <span className="text-brown/30">/</span>
          <span className="font-medium text-brown">{openFolder.name}</span>
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
            <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
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

      {folderError && <p className="mb-3 text-sm text-red-700">{folderError}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {folders.map((folder) => {
          const files = filesByFolder.get(folder.name) ?? [];
          return (
            <div key={folder.id} className="group relative">
              {renamingId === folder.id ? (
                <div className="card flex flex-col items-center gap-2 p-4 text-center">
                  <FolderIcon className="h-10 w-10 text-gold" />
                  <input
                    className="w-full rounded border border-gold px-1 py-0.5 text-center text-sm"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameFolder(folder.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(folder.id)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setOpenFolderId(folder.id)}
                  className="card flex w-full flex-col items-center gap-2 p-4 text-center hover:bg-taupe/5"
                >
                  <FolderIcon className="h-10 w-10 text-gold" />
                  <span className="text-sm font-medium text-brown">{folder.name}</span>
                  <span className="text-xs text-brown/50">
                    {files.length} file{files.length === 1 ? '' : 's'}
                  </span>
                </button>
              )}
              {renamingId !== folder.id && (
                <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                  <button
                    className="rounded bg-white/90 px-1 text-xs text-brown/50 hover:text-brown"
                    title="Rename folder"
                    onClick={() => {
                      setRenamingId(folder.id);
                      setRenameValue(folder.name);
                    }}
                  >
                    ✎
                  </button>
                  {folders.length > 1 && (
                    <button
                      className="rounded bg-white/90 px-1 text-xs text-brown/50 hover:text-red-700"
                      title="Delete folder"
                      onClick={() => setPendingDeleteFolder(folder)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNewFolder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={handleCreateFolder} className="card w-full max-w-sm space-y-4 p-6">
            <h2 className="text-lg font-medium text-brown">New Folder</h2>
            <input
              className="input"
              required
              autoFocus
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            {folderError && <p className="text-sm text-red-700">{folderError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowNewFolder(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creatingFolder}>
                {creatingFolder ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDeleteFolder}
        title="Delete folder?"
        message={`Files in "${pendingDeleteFolder?.name}" will move to Uncategorized rather than being deleted.`}
        busy={deletingFolder}
        onConfirm={confirmDeleteFolder}
        onCancel={() => setPendingDeleteFolder(null)}
      />
    </div>
  );
}
