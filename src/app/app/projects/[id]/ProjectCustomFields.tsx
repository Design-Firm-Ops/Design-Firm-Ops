'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface FieldDefRow {
  id: string;
  label: string;
  fieldType: string;
  order: number;
  visibleToDesigner: boolean;
}

export interface FieldValueRow {
  fieldDefId: string;
  value: string | null;
}

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'CURRENCY', 'RICH_TEXT'];

export default function ProjectCustomFields({
  projectId,
  fieldDefs,
  fieldValues,
  isAdmin,
}: {
  projectId: string;
  fieldDefs: FieldDefRow[];
  fieldValues: FieldValueRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [defs, setDefs] = useState(fieldDefs);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fieldValues.map((v) => [v.fieldDefId, v.value ?? '']))
  );
  const [managing, setManaging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState({ label: '', fieldType: 'TEXT', visibleToDesigner: true });
  const [saving, setSaving] = useState(false);

  const visibleDefs = isAdmin ? defs : defs.filter((d) => d.visibleToDesigner);

  async function saveValue(fieldDefId: string, value: string) {
    await fetch(`/api/projects/${projectId}/field-values`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldDefId, value }),
    });
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    if (!newField.label.trim()) return;
    setSaving(true);
    const res = await fetch('/api/project-field-defs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newField),
    });
    setSaving(false);
    if (res.ok) {
      const created = await res.json();
      setDefs((prev) => [...prev, created]);
      setNewField({ label: '', fieldType: 'TEXT', visibleToDesigner: true });
      setShowAdd(false);
    }
  }

  async function handleDeleteField(id: string) {
    await fetch(`/api/project-field-defs/${id}`, { method: 'DELETE' });
    setDefs((prev) => prev.filter((d) => d.id !== id));
    router.refresh();
  }

  async function handleToggleVisibility(field: FieldDefRow) {
    const visibleToDesigner = !field.visibleToDesigner;
    setDefs((prev) => prev.map((d) => (d.id === field.id ? { ...d, visibleToDesigner } : d)));
    await fetch(`/api/project-field-defs/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibleToDesigner }),
    });
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    const reordered = [...defs];
    const fromIndex = reordered.findIndex((d) => d.id === draggingId);
    const toIndex = reordered.findIndex((d) => d.id === targetId);
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setDefs(reordered);
    setDraggingId(null);

    fetch('/api/project-field-defs/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: reordered.map((d) => d.id) }),
    }).then(() => router.refresh());
  }

  if (defs.length === 0 && !isAdmin) return null;

  return (
    <div className="mt-6 border-t border-taupe/30 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brown/60">Additional Fields</h2>
        {isAdmin && (
          <button className="text-xs text-brown/50 underline hover:text-brown" onClick={() => setManaging((m) => !m)}>
            {managing ? 'Done' : 'Manage Fields'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {visibleDefs.map((field) => (
          <div
            key={field.id}
            draggable={managing}
            onDragStart={() => setDraggingId(field.id)}
            onDragOver={(e) => managing && e.preventDefault()}
            onDrop={() => managing && handleDrop(field.id)}
            className={managing ? 'cursor-grab rounded border border-dashed border-taupe/50 p-2 active:cursor-grabbing' : ''}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs text-brown/50">
                {field.label} {!field.visibleToDesigner && isAdmin && <span className="text-gold">(admin only)</span>}
              </label>
              {managing && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="text-xs text-brown/40 hover:text-brown"
                    onClick={() => handleToggleVisibility(field)}
                    title="Toggle Designer visibility"
                  >
                    👁
                  </button>
                  <button
                    type="button"
                    className="text-xs text-brown/40 hover:text-red-700"
                    onClick={() => handleDeleteField(field.id)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <input
              type={field.fieldType === 'DATE' ? 'date' : field.fieldType === 'NUMBER' || field.fieldType === 'CURRENCY' ? 'number' : 'text'}
              className="input mt-1"
              value={values[field.id] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              onBlur={(e) => saveValue(field.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      {isAdmin && managing && (
        <div className="mt-4">
          {!showAdd ? (
            <button className="text-sm text-gold hover:underline" onClick={() => setShowAdd(true)}>
              + Add Field
            </button>
          ) : (
            <form onSubmit={handleAddField} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Label</label>
                <input
                  className="input w-48"
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Type</label>
                <select
                  className="input w-32"
                  value={newField.fieldType}
                  onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <label className="mb-2 flex items-center gap-1.5 text-xs text-brown">
                <input
                  type="checkbox"
                  checked={newField.visibleToDesigner}
                  onChange={(e) => setNewField({ ...newField, visibleToDesigner: e.target.checked })}
                />
                Designers can view
              </label>
              <button type="submit" className="btn-secondary py-1.5 text-xs" disabled={saving}>
                {saving ? 'Adding…' : 'Add'}
              </button>
              <button type="button" className="text-xs text-brown/50" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
