'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiError, apiSend } from '@/lib/apiClient';

// A small "files attached to this record" panel. Items and leads each had
// their own copy of this, identical apart from the endpoints and the copy.

export interface AttachedDocument {
  id: string;
  filename: string;
  url: string | null;
}

export default function AttachedDocuments({
  listUrl,
  uploadUrl = listUrl,
  deleteUrl,
  extraFields,
  heading = 'Documents',
  emptyMessage = 'No documents attached yet.',
}: {
  /** GET here for the current list. */
  listUrl: string;
  /** POST the multipart upload here. Defaults to `listUrl`. */
  uploadUrl?: string;
  /** Builds the DELETE endpoint for one document. */
  deleteUrl: (documentId: string) => string;
  /** Extra multipart fields the upload endpoint needs (projectId, itemId, type…). */
  extraFields?: Record<string, string>;
  heading?: string;
  emptyMessage?: string;
}) {
  const [docs, setDocs] = useState<AttachedDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(listUrl)
      .then((res) => (res.ok ? res.json() : []))
      .then(setDocs);
  }, [listUrl]);

  useEffect(load, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);
    for (const [key, value] of Object.entries(extraFields ?? {})) body.append(key, value);

    const res = await fetch(uploadUrl, { method: 'POST', body });
    setUploading(false);
    e.target.value = '';

    if (!res.ok) {
      setError(await apiError(res, 'Upload failed.'));
      return;
    }
    load();
  }

  async function handleDelete(documentId: string) {
    await apiSend(deleteUrl(documentId), 'DELETE');
    load();
  }

  return (
    <div className="space-y-2 rounded-md border border-taupe/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-brown">{heading}</h3>
        <label className="cursor-pointer text-xs text-gold hover:underline">
          {uploading ? 'Uploading…' : '+ Upload'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {docs === null && <p className="text-xs text-brown/50">Loading…</p>}
      {docs?.length === 0 && <p className="text-xs text-brown/50">{emptyMessage}</p>}
      {docs && docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between text-xs">
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-brown hover:text-gold">
                  {doc.filename}
                </a>
              ) : (
                <span className="text-brown/50">{doc.filename}</span>
              )}
              <button type="button" className="text-red-700 hover:text-red-900" onClick={() => handleDelete(doc.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
