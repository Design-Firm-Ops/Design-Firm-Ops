'use client';

import { useRouter } from 'next/navigation';
import { FIRM_STATUSES } from '@/lib/domain';
import { firmsHref, type FirmFilters as Filters } from '@/lib/firms';

// Search and status filter for the firms list.
//
// Navigates rather than holding state: the URL is the filter, so a filtered
// view can be linked, reloaded and shared. `firmsHref` owns the query-string
// shape (see src/lib/firms.ts) so this and the page can't disagree about it.

const STATUS_LABELS: Record<string, string> = {
  ALL: 'All Statuses',
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  CANCELED: 'Canceled',
};

export default function FirmFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const go = (next: Filters) => router.push(firmsHref(next));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const search = new FormData(e.currentTarget).get('q');
          go({ ...filters, search: typeof search === 'string' ? search.trim() : '' });
        }}
      >
        <label htmlFor="firm-search" className="sr-only">
          Search firms
        </label>
        <input
          id="firm-search"
          name="q"
          type="search"
          className="input w-auto"
          placeholder="Search firms…"
          defaultValue={filters.search}
          // Keyed by the current search so that navigating (including Back)
          // re-seeds the box from the URL rather than stranding the old text.
          key={filters.search}
        />
      </form>

      <label htmlFor="firm-status" className="sr-only">
        Filter by status
      </label>
      <select
        id="firm-status"
        className="input w-auto"
        value={filters.status}
        onChange={(e) => go({ ...filters, status: e.target.value as Filters['status'] })}
      >
        {(['ALL', ...FIRM_STATUSES] as const).map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
