'use client';

import { useRouter } from 'next/navigation';

const OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETE', label: 'Complete' },
  { value: 'ALL', label: 'All Statuses' },
];

export default function StatusFilter({ value }: { value: string }) {
  const router = useRouter();

  return (
    <select
      className="input w-auto"
      value={value}
      onChange={(e) => router.push(`/app/projects?status=${e.target.value}`)}
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
