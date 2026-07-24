'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LeadsBoard, { LeadRow, StageRow } from './LeadsBoard';
import { apiError, apiSend } from '@/lib/apiClient';

const MAX_BOARDS = 5;

export interface BoardData {
  id: string;
  name: string;
  stages: StageRow[];
  leads: LeadRow[];
}

export default function BusinessDevTabs({
  boards,
  referralPartners,
  projectTypeOptions,
  referralPartnersContent,
}: {
  boards: BoardData[];
  referralPartners: { id: string; name: string }[];
  projectTypeOptions: string[];
  referralPartnersContent: React.ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string>(boards[0]?.id ?? 'partners');
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    setCreating(true);
    setError(null);

    const res = await apiSend('/api/lead-boards', 'POST', { name: newBoardName.trim() });
    setCreating(false);

    if (!res.ok) {
      setError(await apiError(res, 'Could not create board.'));
      return;
    }

    const board = await res.json();
    setShowNewBoard(false);
    setNewBoardName('');
    setActive(board.id);
    router.refresh();
  }

  async function handleRenameBoard(boardId: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    await apiSend(`/api/lead-boards/${boardId}`, 'PATCH', { name: renameValue.trim() });
    setRenamingId(null);
    router.refresh();
  }

  async function handleDeleteBoard(boardId: string) {
    const res = await apiSend(`/api/lead-boards/${boardId}`, 'DELETE');
    if (!res.ok) {
      setError(await apiError(res, 'Could not delete board.'));
      return;
    }
    setActive(boards.find((b) => b.id !== boardId)?.id ?? 'partners');
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-taupe/40">
        {boards.map((board) => (
          <div key={board.id} className="group relative flex items-center">
            {renamingId === board.id ? (
              <input
                className="w-32 rounded border border-gold px-2 py-1 text-sm"
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameBoard(board.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameBoard(board.id)}
              />
            ) : (
              <button
                onClick={() => setActive(board.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  active === board.id ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
                }`}
              >
                {board.name}
              </button>
            )}
            {active === board.id && renamingId !== board.id && (
              <button
                className="ml-1 text-xs text-brown/30 hover:text-brown"
                title="Rename board"
                onClick={() => {
                  setRenamingId(board.id);
                  setRenameValue(board.name);
                }}
              >
                ✎
              </button>
            )}
            {boards.length > 1 && active === board.id && renamingId !== board.id && (
              <button
                className="ml-1 text-xs text-brown/30 hover:text-red-700"
                title="Delete board"
                onClick={() => handleDeleteBoard(board.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {boards.length < MAX_BOARDS && (
          <button
            className="px-3 py-2 text-sm text-brown/50 hover:text-brown"
            onClick={() => setShowNewBoard(true)}
          >
            + Board
          </button>
        )}
        <button
          onClick={() => setActive('partners')}
          className={`ml-auto px-4 py-2 text-sm font-medium transition-colors ${
            active === 'partners' ? 'border-b-2 border-gold text-brown' : 'text-brown/50 hover:text-brown'
          }`}
        >
          Referral Partners
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {showNewBoard && (
        <form onSubmit={handleCreateBoard} className="mb-4 flex items-center gap-2">
          <input
            className="input w-64"
            placeholder="Board name, e.g. Commercial"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-secondary" disabled={creating}>
            {creating ? 'Adding…' : 'Add'}
          </button>
          <button type="button" className="text-sm text-brown/50 hover:text-brown" onClick={() => setShowNewBoard(false)}>
            Cancel
          </button>
        </form>
      )}

      {boards.map(
        (board) =>
          active === board.id && (
            <LeadsBoard
              key={board.id}
              boardId={board.id}
              initialStages={board.stages}
              initialLeads={board.leads}
              referralPartners={referralPartners}
              projectTypeOptions={projectTypeOptions}
            />
          )
      )}
      {active === 'partners' && referralPartnersContent}
    </div>
  );
}
