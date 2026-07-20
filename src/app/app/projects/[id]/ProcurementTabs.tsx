'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ItemsTable, { ItemRow } from './ItemsTable';
import { ItemFieldDefRow } from './ItemDetailModal';

export interface ProcurementListData {
  id: string;
  name: string;
  items: ItemRow[];
}

export default function ProcurementTabs({
  projectId,
  lists,
  vendors,
  offeringOptions,
  itemFieldDefs,
  isAdmin,
  projectDefaultMarkupPct,
  projectMarkupMode,
}: {
  projectId: string;
  lists: ProcurementListData[];
  vendors: { id: string; name: string }[];
  offeringOptions: { id: string; name: string }[];
  itemFieldDefs: ItemFieldDefRow[];
  isAdmin: boolean;
  projectDefaultMarkupPct: string;
  projectMarkupMode: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(lists[0]?.id ?? '');
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    setCreating(true);
    setError(null);

    const res = await fetch('/api/procurement-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: newListName.trim() }),
    });
    setCreating(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Could not create list.');
      return;
    }

    const list = await res.json();
    setShowNewList(false);
    setNewListName('');
    setActive(list.id);
    router.refresh();
  }

  async function handleRename(listId: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    await fetch(`/api/procurement-lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingId(null);
    router.refresh();
  }

  async function handleDeleteList(listId: string) {
    const res = await fetch(`/api/procurement-lists/${listId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Could not delete list.');
      return;
    }
    setActive(lists.find((l) => l.id !== listId)?.id ?? '');
    router.refresh();
  }

  const activeList = lists.find((l) => l.id === active) ?? lists[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-taupe/40">
        {lists.map((list) => (
          <div key={list.id} className="group flex items-center">
            {renamingId === list.id ? (
              <input
                className="w-32 rounded border border-gold px-2 py-1 text-sm"
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRename(list.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(list.id)}
              />
            ) : (
              <button
                onClick={() => setActive(list.id)}
                onDoubleClick={() => {
                  if (list.id === 'unassigned') return;
                  setRenamingId(list.id);
                  setRenameValue(list.name);
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  active === list.id ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
                }`}
                title={list.id === 'unassigned' ? undefined : 'Double-click to rename'}
              >
                {list.name} <span className="text-xs text-brown/40">({list.items.length})</span>
              </button>
            )}
            {active === list.id && list.id !== 'unassigned' && renamingId !== list.id && (
              <button
                className="ml-1 text-xs text-brown/30 hover:text-brown"
                title="Rename list"
                onClick={() => {
                  setRenamingId(list.id);
                  setRenameValue(list.name);
                }}
              >
                ✎
              </button>
            )}
            {active === list.id &&
              list.id !== 'unassigned' &&
              renamingId !== list.id &&
              lists.filter((l) => l.id !== 'unassigned').length > 1 && (
                <button
                  className="ml-1 text-xs text-brown/30 hover:text-red-700"
                  title="Delete list"
                  onClick={() => handleDeleteList(list.id)}
                >
                  ✕
                </button>
              )}
          </div>
        ))}
        <button className="px-3 py-2 text-sm text-brown/50 hover:text-brown" onClick={() => setShowNewList(true)}>
          + List
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {showNewList && (
        <form onSubmit={handleCreateList} className="mb-4 flex items-center gap-2">
          <input
            className="input w-64"
            placeholder="List name, e.g. Textiles"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-secondary" disabled={creating}>
            {creating ? 'Adding…' : 'Add'}
          </button>
          <button type="button" className="text-sm text-brown/50 hover:text-brown" onClick={() => setShowNewList(false)}>
            Cancel
          </button>
        </form>
      )}

      {activeList && (
        <ItemsTable
          key={activeList.id}
          projectId={projectId}
          procurementListId={activeList.id}
          initialItems={activeList.items}
          vendors={vendors}
          offeringOptions={offeringOptions}
          itemFieldDefs={itemFieldDefs}
          isAdmin={isAdmin}
          projectDefaultMarkupPct={projectDefaultMarkupPct}
          projectMarkupMode={projectMarkupMode}
          copyTargets={lists.filter((l) => l.id !== activeList.id && l.id !== 'unassigned').map((l) => ({ id: l.id, name: l.name }))}
        />
      )}
      {!activeList && <p className="py-8 text-center text-brown/50">No procurement lists yet.</p>}
    </div>
  );
}
