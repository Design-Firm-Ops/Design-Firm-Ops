'use client';

import { useState } from 'react';
import type { FieldDefRow } from './ProjectCustomFields';

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'CURRENCY', 'RICH_TEXT'];

export default function ProjectFieldsManager({
  fieldDefs,
  onChange,
}: {
  fieldDefs: FieldDefRow[];
  onChange: (defs: FieldDefRow[]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState({ label: '', fieldType: 'TEXT', visibleToDesigner: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    if (!newField.label.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/project-field-defs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newField),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Could not add field.');
      return;
    }
    const created = await res.json();
    onChange([...fieldDefs, created]);
    setNewField({ label: '', fieldType: 'TEXT', visibleToDesigner: true });
    setShowAdd(false);
  }

  async function handleRenameField(id: string, label: string) {
    if (!label.trim()) return;
    onChange(fieldDefs.map((d) => (d.id === id ? { ...d, label } : d)));
    await fetch(`/api/project-field-defs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
  }

  async function handleDeleteField(id: string) {
    onChange(fieldDefs.filter((d) => d.id !== id));
    await fetch(`/api/project-field-defs/${id}`, { method: 'DELETE' });
  }

  async function handleToggleVisibility(field: FieldDefRow) {
    const visibleToDesigner = !field.visibleToDesigner;
    onChange(fieldDefs.map((d) => (d.id === field.id ? { ...d, visibleToDesigner } : d)));
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
    const reordered = [...fieldDefs];
    const fromIndex = reordered.findIndex((d) => d.id === draggingId);
    const toIndex = reordered.findIndex((d) => d.id === targetId);
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    onChange(reordered);
    setDraggingId(null);

    fetch('/api/project-field-defs/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: reordered.map((d) => d.id) }),
    });
  }

  return (
    <div className="rounded-md border border-taupe/40 p-4">
      <h3 className="mb-1 text-sm font-medium text-brown">Custom Fields</h3>
      <p className="mb-3 text-xs text-brown/50">
        Shown on the project overview below. Drag to reorder; the eye icon controls whether Designers can see a field.
      </p>

      <div className="space-y-2">
        {fieldDefs.map((field) => (
          <div
            key={field.id}
            draggable
            onDragStart={() => setDraggingId(field.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(field.id)}
            className="flex cursor-grab items-center gap-2 rounded border border-dashed border-taupe/50 p-2 active:cursor-grabbing"
          >
            <input
              className="input flex-1 py-1"
              defaultValue={field.label}
              onBlur={(e) => handleRenameField(field.id, e.target.value)}
            />
            <span className="text-xs text-brown/40">{field.fieldType}</span>
            <button
              type="button"
              className="text-xs text-brown/40 hover:text-brown"
              onClick={() => handleToggleVisibility(field)}
              title={field.visibleToDesigner ? 'Visible to Designers — click to hide' : 'Admin only — click to show Designers'}
            >
              {field.visibleToDesigner ? '👁' : '🚫'}
            </button>
            <button type="button" className="text-xs text-brown/40 hover:text-red-700" onClick={() => handleDeleteField(field.id)}>
              ✕
            </button>
          </div>
        ))}
        {fieldDefs.length === 0 && <p className="text-xs text-brown/50">No custom fields yet.</p>}
      </div>

      <div className="mt-3">
        {!showAdd ? (
          <button type="button" className="text-sm text-gold hover:underline" onClick={() => setShowAdd(true)}>
            + Add Field
          </button>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
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
            <button type="button" className="btn-secondary py-1.5 text-xs" onClick={handleAddField} disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button type="button" className="text-xs text-brown/50" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
