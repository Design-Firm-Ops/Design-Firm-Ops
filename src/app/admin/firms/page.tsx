import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { getPlatformDb } from '@/server/platformDb';
import { listFirms } from '@/server/queries/firms';
import { parseFirmFilters } from '@/lib/firms';
import { formatDate } from '@/lib/format';
import FirmFilters from './FirmFilters';
import FirmStatusBadge from '@/components/FirmStatusBadge';

export const dynamic = 'force-dynamic';

// Every firm on the platform.
//
// The one screen in the app that deliberately reads across tenants, and it
// does so through `getPlatformDb` — which throws for anyone who isn't the
// platform operator. Nothing here is tenant-scoped, which is why the door is
// named and guarded rather than implied.

export default async function AdminFirmsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  const db = getPlatformDb(session);

  const filters = parseFirmFilters(searchParams);
  const firms = await listFirms(db, filters);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-brown">Firms</h1>
          <p className="text-sm text-brown/60">
            {firms.length} {firms.length === 1 ? 'firm' : 'firms'}
          </p>
        </div>
        <FirmFilters filters={filters} />
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className="px-4 py-3">Firm</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Users</th>
              <th className="px-4 py-3 text-right">Projects</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {firms.map((firm) => (
              <tr key={firm.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3">
                  <Link href={`/admin/firms/${firm.id}`} className="font-medium text-brown hover:text-gold">
                    {firm.name}
                  </Link>
                  <span className="block text-xs text-brown/50">{firm.slug}</span>
                </td>
                <td className="px-4 py-3">
                  <FirmStatusBadge status={firm.status} />
                </td>
                <td className="px-4 py-3 text-brown/70">{firm.plan ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-brown/70">{firm.userCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-brown/70">{firm.projectCount}</td>
                <td className="px-4 py-3 text-brown/70">{formatDate(firm.createdAt)}</td>
                {/* A firm nobody has worked in yet has no date, which is a real
                    answer rather than a missing one. */}
                <td className="px-4 py-3 text-brown/70">
                  {firm.lastActivityAt ? formatDate(firm.lastActivityAt) : '—'}
                </td>
              </tr>
            ))}
            {firms.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brown/50">
                  No firms match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
