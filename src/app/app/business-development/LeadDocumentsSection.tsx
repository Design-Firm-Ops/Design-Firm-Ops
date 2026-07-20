'use client';

import { useEffect, useState } from 'react';

interface LeadDocRow {
  id: string;
  filename: string;
  url: string | null;
  uploadedAt: string;
}

export default function LeadDocumentsSection({ leadId }: { leadId: string }) {
  const [docs, setDocs] = useState<LeadDocRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/leads/${leadId}/documents`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setDocs);
  }

  useEffect(load, [leadId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);

    const res = await fetch(`/api/leads/${leadId}/documents`, { method: 'POST', body });
    setUploading(false);
    e.target.value = '';

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Upload failed.');
      return;
    }
    load();
  }

  async function handleDelete(docId: string) {
    await fetch(`/api/leads/${leadId}/documents/${docId}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-3 rounded-md border border-taupe/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-brown">Documents</h3>
        <label className="text-xs text-gold hover:underline cursor-pointer">
          {uploading ? 'Uploading…' : '+ Upload'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {docs === null && <p className="text-xs text-brown/50">Loading…</p>}
      {docs && docs.length === 0 && <p className="text-xs text-brown/50">No documents saved to this lead yet.</p>}
      {docs && docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between text-xs">
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" className="text-brown hover:text-gold">
                  {d.filename}
                </a>
              ) : (
                <span className="text-brown/50">{d.filename}</span>
              )}
              <button type="button" className="text-red-700 hover:text-red-900" onClick={() => handleDelete(d.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
