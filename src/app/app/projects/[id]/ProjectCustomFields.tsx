'use client';

import { useState } from 'react';
import { apiSend } from '@/lib/apiClient';

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
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fieldValues.map((v) => [v.fieldDefId, v.value ?? '']))
  );

  const visibleDefs = isAdmin ? fieldDefs : fieldDefs.filter((d) => d.visibleToDesigner);

  async function saveValue(fieldDefId: string, value: string) {
    await apiSend(`/api/projects/${projectId}/field-values`, 'PATCH', { fieldDefId, value });
  }

  if (visibleDefs.length === 0) return null;

  return (
    <div className="mt-6 border-t border-taupe/30 pt-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.24em] text-taupe">Additional Fields</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {visibleDefs.map((field) => (
          <div key={field.id}>
            <label className="text-xs text-brown/50">
              {field.label} {!field.visibleToDesigner && isAdmin && <span className="text-gold">(admin only)</span>}
            </label>
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
    </div>
  );
}
