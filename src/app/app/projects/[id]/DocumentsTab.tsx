'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import { apiError, apiSend } from '@/lib/apiClient';
import { formatDate } from '@/lib/format';

export interface DocumentRow {
  id: string;
  type: string;
  filename: string;
  // A short-lived signed URL generated fresh on each page load — null
  // if it couldn't be minted (e.g. storage temporarily unreachable).
  url: string | null;
  uploadedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  PRESENTATION: 'Presentation',
  VENDOR_INVOICE: 'Vendor Invoice',
  CONTRACT: 'Contract',
  OTHER: 'Other',
};

/**
 * Generic document list + uploader. Used as-is for the Documents tab,
 * and with a fixed single allowed type for the Contracts tab.
 */
export default function DocumentsTab({
  projectId,
  documents,
  allowedTypes = ['PRESENTATION', 'VENDOR_INVOICE', 'CONTRACT', 'OTHER'],
  defaultType,
  emptyLabel = 'No documents uploaded yet.',
}: {
  projectId: string;
  documents: DocumentRow[];
  allowedTypes?: string[];
  defaultType?: string;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState(defaultType ?? allowedTypes[0]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);
    body.append('projectId', projectId);
    body.append('type', type);

    const res = await fetch('/api/documents', { method: 'POST', body });
    setUploading(false);
    e.target.value = '';

    if (!res.ok) {
      setError(await apiError(res, 'Upload failed.'));
      return;
    }

    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    await apiSend(`/api/documents/${pendingDelete.id}`, 'DELETE');
    setDeleting(false);
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {allowedTypes.length > 1 && (
          <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            {allowedTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        )}
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
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3">
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="font-medium text-brown hover:text-gold">
                      {doc.filename}
                    </a>
                  ) : (
                    <span className="font-medium text-brown/50" title="Link unavailable — reload the page to retry">
                      {doc.filename}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-brown/70">{TYPE_LABELS[doc.type]}</td>
                <td className="px-4 py-3 text-brown/70">{formatDate(doc.uploadedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-sm text-red-700 hover:text-red-900" onClick={() => setPendingDelete(doc)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brown/50">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete document?"
        message={`This will permanently delete "${pendingDelete?.filename}" from storage records. This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
