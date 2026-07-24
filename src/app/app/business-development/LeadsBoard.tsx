'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import LeadFormModal from './LeadFormModal';
import { apiError, apiSend } from '@/lib/apiClient';

export interface StageRow {
  id: string;
  name: string;
  order: number;
}

export interface LeadRow {
  id: string;
  clientName: string;
  projectType: string | null;
  referralSource: string | null;
  referralPartnerId: string | null;
  referralPartnerName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  pipelineStageId: string;
  sortOrder: number;
  convertedProjectId: string | null;
  squareFootage: number | null;
  estimatedBudget: string | null;
  timeline: string | null;
  builderName: string | null;
  architectName: string | null;
}

export default function LeadsBoard({
  boardId,
  initialStages,
  initialLeads,
  referralPartners,
  projectTypeOptions,
}: {
  boardId: string;
  initialStages: StageRow[];
  initialLeads: LeadRow[];
  referralPartners: { id: string; name: string }[];
  projectTypeOptions: string[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  const [leads, setLeads] = useState(initialLeads);

  // LeadFormModal (create/edit/delete) only triggers router.refresh(),
  // it doesn't patch local state directly — resync whenever the
  // server gives us fresh props rather than mirroring every mutation
  // path by hand.
  useEffect(() => setStages(initialStages), [initialStages]);
  useEffect(() => setLeads(initialLeads), [initialLeads]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<LeadRow | 'new' | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [addingStage, setAddingStage] = useState(false);
  const [pendingDeleteStage, setPendingDeleteStage] = useState<StageRow | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  async function handleDrop(stageId: string) {
    setDragOverStage(null);
    if (!draggingId) return;
    const lead = leads.find((l) => l.id === draggingId);
    if (!lead || lead.pipelineStageId === stageId) {
      setDraggingId(null);
      return;
    }

    const targetLeads = leads.filter((l) => l.pipelineStageId === stageId);
    const newSortOrder = targetLeads.length > 0 ? Math.max(...targetLeads.map((l) => l.sortOrder)) + 1 : 0;

    setLeads((prev) => prev.map((l) => (l.id === draggingId ? { ...l, pipelineStageId: stageId, sortOrder: newSortOrder } : l)));
    setDraggingId(null);

    await apiSend(`/api/leads/${lead.id}/move`, 'PATCH', { pipelineStageId: stageId, sortOrder: newSortOrder });
    router.refresh();
  }

  async function handleAddStage(e: React.FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    setAddingStage(true);

    const res = await apiSend('/api/pipeline-stages', 'POST', { name: newStageName.trim(), boardId });
    setAddingStage(false);

    if (res.ok) {
      const stage = await res.json();
      setStages((prev) => [...prev, stage]);
      setNewStageName('');
    }
  }

  async function handleRenameStage(stage: StageRow, name: string) {
    setStages((prev) => prev.map((s) => (s.id === stage.id ? { ...s, name } : s)));
    await apiSend(`/api/pipeline-stages/${stage.id}`, 'PATCH', { name });
    router.refresh();
  }

  async function confirmDeleteStage() {
    if (!pendingDeleteStage) return;
    setStageError(null);
    const res = await apiSend(`/api/pipeline-stages/${pendingDeleteStage.id}`, 'DELETE');
    if (!res.ok) {
      setStageError(await apiError(res, 'Failed to delete stage.'));
      return;
    }
    setStages((prev) => prev.filter((s) => s.id !== pendingDeleteStage.id));
    setPendingDeleteStage(null);
    router.refresh();
  }

  async function handleConvert(lead: LeadRow) {
    setConvertingId(lead.id);
    const res = await fetch(`/api/leads/${lead.id}/convert`, { method: 'POST' });
    setConvertingId(null);
    if (res.ok) {
      const data = await res.json();
      router.push(`/app/projects/${data.project.id}`);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleAddStage} className="flex gap-2">
          <input
            className="input w-auto"
            placeholder="New stage name"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
          />
          <button type="submit" className="btn-secondary" disabled={addingStage}>
            + Add Column
          </button>
        </form>
        <button className="btn-primary" onClick={() => setEditingLead('new')}>
          + New Lead
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.pipelineStageId === stage.id).sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div
              key={stage.id}
              className={`w-72 flex-shrink-0 rounded-lg border ${
                dragOverStage === stage.id ? 'border-gold bg-gold/5' : 'border-taupe/40 bg-taupe/5'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage((prev) => (prev === stage.id ? null : prev))}
              onDrop={() => handleDrop(stage.id)}
            >
              <div className="flex items-center justify-between gap-2 border-b border-taupe/30 p-3">
                <input
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-brown hover:border-taupe/40 focus:border-gold focus:outline-none"
                  value={stage.name}
                  onChange={(e) => handleRenameStage(stage, e.target.value)}
                />
                <button
                  className="text-brown/40 hover:text-red-700"
                  title="Delete column"
                  onClick={() => setPendingDeleteStage(stage)}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2 p-2">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggingId(lead.id)}
                    onClick={() => setEditingLead(lead)}
                    className="card cursor-grab space-y-1 p-3 text-sm active:cursor-grabbing"
                  >
                    <p className="font-medium text-brown">{lead.clientName}</p>
                    {lead.projectType && <p className="text-xs text-brown/60">{lead.projectType}</p>}
                    {lead.referralPartnerName && (
                      <p className="text-xs text-brown/50">via {lead.referralPartnerName}</p>
                    )}
                    {(lead.builderName || lead.architectName) && (
                      <p className="text-xs text-brown/50">
                        {lead.builderName && <>Builder: {lead.builderName}</>}
                        {lead.builderName && lead.architectName && ' · '}
                        {lead.architectName && <>Architect: {lead.architectName}</>}
                      </p>
                    )}
                    {lead.convertedProjectId ? (
                      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        Converted
                      </span>
                    ) : (
                      <button
                        className="text-xs text-gold hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConvert(lead);
                        }}
                        disabled={convertingId === lead.id}
                      >
                        {convertingId === lead.id ? 'Converting…' : 'Convert to Project →'}
                      </button>
                    )}
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <p className="p-3 text-center text-xs text-brown/40">No leads here yet.</p>
                )}
              </div>
            </div>
          );
        })}
        {stages.length === 0 && (
          <div className="card w-full p-8 text-center text-brown/50">
            No pipeline stages yet. Add one above to get started.
          </div>
        )}
      </div>

      {editingLead && (
        <LeadFormModal
          lead={editingLead === 'new' ? null : editingLead}
          stages={stages}
          referralPartners={referralPartners}
          projectTypeOptions={projectTypeOptions}
          onClose={() => setEditingLead(null)}
          onSaved={() => {
            setEditingLead(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeleteStage}
        title="Delete column?"
        message={stageError ?? `This will permanently delete the "${pendingDeleteStage?.name}" column.`}
        onConfirm={confirmDeleteStage}
        onCancel={() => {
          setPendingDeleteStage(null);
          setStageError(null);
        }}
      />
    </div>
  );
}
