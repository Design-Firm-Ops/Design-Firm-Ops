'use client';

import { useState } from 'react';
import { apiSend } from '@/lib/apiClient';

export interface ItemFieldDefRow {
  id: string;
  label: string;
  fieldType: string;
  order: number;
  visibleToDesigner: boolean;
}

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'CURRENCY', 'RICH_TEXT'];

export default function ItemCustomFields({
  itemId,
  fieldDefs,
  initialValues,
  isAdmin,
  onDefsChanged,
}: {
  itemId: string;
  fieldDefs: ItemFieldDefRow[];
  initialValues: Record<string, string>;
  isAdmin: boolean;
  onDefsChanged: (defs: ItemFieldDefRow[]) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [managing, setManaging] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState({ label: '', fieldType: 'TEXT', visibleToDesigner: true });
  const [saving, setSaving] = useState(false);

  const visibleDefs = isAdmin ? fieldDefs : fieldDefs.filter((d) => d.visibleToDesigner);

  async function saveValue(fieldDefId: string, value: string) {
    await apiSend(`/api/items/${itemId}/field-values`, 'PATCH', { fieldDefId, value });
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    if (!newField.label.trim()) return;
    setSaving(true);
    const res = await apiSend('/api/item-field-defs', 'POST', newField);
    setSaving(false);
    if (res.ok) {
      const created = await res.json();
      onDefsChanged([...fieldDefs, created]);
      setNewField({ label: '', fieldType: 'TEXT', visibleToDesigner: true });
      setShowAdd(false);
    }
  }

  async function handleDeleteField(id: string) {
    await apiSend(`/api/item-field-defs/${id}`, 'DELETE');
    onDefsChanged(fieldDefs.filter((d) => d.id !== id));
  }

  async function handleToggleVisibility(field: ItemFieldDefRow) {
    const visibleToDesigner = !field.visibleToDesigner;
    onDefsChanged(fieldDefs.map((d) => (d.id === field.id ? { ...d, visibleToDesigner } : d)));
    await apiSend(`/api/item-field-defs/${field.id}`, 'PATCH', { visibleToDesigner });
  }

  if (fieldDefs.length === 0 && !isAdmin) return null;

  return (
    <div className="space-y-3 rounded-md border border-taupe/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-brown">Additional Fields</h3>
        {isAdmin && (
          <button type="button" className="text-xs text-brown/50 underline hover:text-brown" onClick={() => setManaging((m) => !m)}>
            {managing ? 'Done' : 'Manage Fields'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visibleDefs.map((field) => (
          <div key={field.id}>
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
        <div>
          {!showAdd ? (
            <button type="button" className="text-sm text-gold hover:underline" onClick={() => setShowAdd(true)}>
              + Add Field
            </button>
          ) : (
            <form onSubmit={handleAddField} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Label</label>
                <input
                  className="input w-40"
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-brown">Type</label>
                <select
                  className="input w-28"
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
