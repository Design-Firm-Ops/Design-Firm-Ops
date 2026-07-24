'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FolderIcon from './FolderIcon';
import FolderView, { ResourceRow } from './FolderView';
import FolderPermissionsEditor from './FolderPermissionsEditor';
import { apiError } from '@/lib/apiClient';
import Modal from '@/components/Modal';

type View = 'rows' | 'icons';

interface Tile {
  key: string;
  label: string;
  sublabel: string;
  keywords: string;
}

export default function AdminBrowser({
  resourceRows,
  allUsers,
  folderPermissions,
  isAdmin,
}: {
  resourceRows: ResourceRow[];
  allUsers: { id: string; name: string; email: string }[];
  folderPermissions: { name: string; allowedUserIds: string[] }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('rows');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const newFolderFileRef = useRef<HTMLInputElement>(null);

  function openFolder(key: string) {
    setHistory((prev) => (openKey ? [...prev, openKey] : prev));
    setOpenKey(key);
  }

  function goBack() {
    setHistory((prev) => {
      if (prev.length === 0) {
        setOpenKey(null);
        return prev;
      }
      const next = [...prev];
      const last = next.pop()!;
      setOpenKey(last);
      return next;
    });
  }

  function goHome() {
    setHistory([]);
    setOpenKey(null);
  }

  const resourcesByFolder = useMemo(() => {
    const map = new Map<string, ResourceRow[]>();
    for (const r of resourceRows) {
      const list = map.get(r.folder) ?? [];
      list.push(r);
      map.set(r.folder, list);
    }
    return map;
  }, [resourceRows]);

  const folderNames = useMemo(() => Array.from(resourcesByFolder.keys()).sort(), [resourcesByFolder]);

  const tiles: Tile[] = useMemo(() => {
    return folderNames.map((f) => {
      const files = resourcesByFolder.get(f) ?? [];
      return {
        key: `folder:${f}`,
        label: f,
        sublabel: `${files.length} file${files.length === 1 ? '' : 's'}`,
        keywords: [f, ...files.map((r) => r.filename)].join(' ').toLowerCase(),
      };
    });
  }, [folderNames, resourcesByFolder]);

  const q = query.trim().toLowerCase();
  const visibleTiles = q ? tiles.filter((t) => t.keywords.includes(q)) : tiles;

  const openTile = tiles.find((t) => t.key === openKey);

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    setNewFolderError(null);

    const file = newFolderFileRef.current?.files?.[0];
    if (!file) {
      setCreatingFolder(false);
      setNewFolderError('Choose a file to create the folder with.');
      return;
    }

    const body = new FormData();
    body.append('file', file);
    body.append('folder', newFolderName.trim());

    const res = await fetch('/api/resources', { method: 'POST', body });
    setCreatingFolder(false);

    if (!res.ok) {
      setNewFolderError(await apiError(res, 'Could not create folder.'));
      return;
    }

    openFolder(`folder:${newFolderName.trim()}`);
    setShowNewFolder(false);
    setNewFolderName('');
    router.refresh();
  }

  if (openKey && openTile) {
    const existingPermissions = folderPermissions.find((f) => f.name === openTile.label);
    return (
      <div>
        <div className="mb-4 flex items-center gap-3 text-sm">
          <button className="btn-secondary py-1 text-xs" onClick={goBack}>
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <button className="text-brown/60 hover:text-brown" onClick={goHome}>
              Documents
            </button>
            <span className="text-brown/30">/</span>
            <span className="font-medium text-brown">{openTile.label}</span>
          </div>
        </div>

        <div className="mb-4">
          <input
            className="input max-w-sm"
            placeholder="Search this section…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {openKey.startsWith('folder:') && (
          <>
            {isAdmin && (
              <FolderPermissionsEditor
                folderName={openTile.label}
                allUsers={allUsers}
                allowedUserIds={existingPermissions?.allowedUserIds ?? []}
              />
            )}
            <FolderView folder={openTile.label} files={resourcesByFolder.get(openTile.label) ?? []} query={query} />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search all documents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-taupe/40 p-0.5">
            <button
              className={`rounded px-3 py-1 text-xs font-medium ${view === 'rows' ? 'bg-brown text-cream' : 'text-brown/60'}`}
              onClick={() => setView('rows')}
            >
              Rows
            </button>
            <button
              className={`rounded px-3 py-1 text-xs font-medium ${view === 'icons' ? 'bg-brown text-cream' : 'text-brown/60'}`}
              onClick={() => setView('icons')}
            >
              Icons
            </button>
          </div>
          <button className="btn-secondary" onClick={() => setShowNewFolder(true)}>
            + New Folder
          </button>
        </div>
      </div>

      {visibleTiles.length === 0 && (
        <p className="py-8 text-center text-brown/50">Nothing matches &ldquo;{query}&rdquo;.</p>
      )}

      {view === 'rows' ? (
        <div className="card divide-y divide-taupe/20">
          {visibleTiles.map((tile) => (
            <button
              key={tile.key}
              onClick={() => openFolder(tile.key)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-taupe/5"
            >
              <FolderIcon className="h-6 w-6 flex-shrink-0 text-gold" />
              <span className="flex-1">
                <span className="block text-sm font-medium text-brown">{tile.label}</span>
                <span className="block text-xs text-brown/50">{tile.sublabel}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visibleTiles.map((tile) => (
            <button
              key={tile.key}
              onClick={() => openFolder(tile.key)}
              className="card flex flex-col items-center gap-2 p-4 text-center hover:bg-taupe/5"
            >
              <FolderIcon className="h-10 w-10 text-gold" />
              <span className="text-sm font-medium text-brown">{tile.label}</span>
              <span className="text-xs text-brown/50">{tile.sublabel}</span>
            </button>
          ))}
        </div>
      )}

      {showNewFolder && (
        <Modal width="sm" onSubmit={handleCreateFolder} className="space-y-4">
          <h2 className="text-lg font-medium text-brown">New Folder</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Folder Name</label>
            <input
              className="input"
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">First File</label>
            <input ref={newFolderFileRef} type="file" className="input" required />
          </div>
          {newFolderError && <p className="text-sm text-red-700">{newFolderError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowNewFolder(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={creatingFolder}>
              {creatingFolder ? 'Creating…' : 'Create'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
