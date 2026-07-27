import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { getPlatformDb } from '@/server/platformDb';
import { getFirmDetail } from '@/server/queries/firms';
import { FIRMS_PATH } from '@/lib/firms';
import { formatDate } from '@/lib/format';
import FirmStatusBadge from '@/components/FirmStatusBadge';
import FirmActions from './FirmActions';

export const dynamic = 'force-dynamic';

// One firm: who's in it, how much it's being used, and the lifecycle controls.

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-[0.24em] text-taupe">{label}</div>
      <div className="mt-1 text-xl text-brown">{value}</div>
    </div>
  );
}

export default async function AdminFirmPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const db = getPlatformDb(session);

  const firm = await getFirmDetail(db, params.id);
  if (!firm) notFound();

  return (
    <div>
      <Link href={FIRMS_PATH} className="text-sm text-brown/60 hover:text-gold">
        ← All firms
      </Link>

      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-medium text-brown">{firm.name}</h1>
            <FirmStatusBadge status={firm.status} />
          </div>
          <p className="mt-1 text-sm text-brown/60">
            {firm.slug} · {firm.plan ?? 'No plan'} · Created {formatDate(firm.createdAt)}
          </p>
        </div>

        <FirmActions firmId={firm.id} firmName={firm.name} status={firm.status} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Users" value={firm.userCount} />
        <Stat label="Projects" value={firm.projectCount} />
        <Stat
          label="Last Activity"
          value={firm.lastActivityAt ? formatDate(firm.lastActivityAt) : '—'}
        />
      </div>

      <h2 className="mb-3 text-lg font-medium text-brown">People</h2>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {firm.users.map((user) => (
              <tr key={user.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3 font-medium text-brown">{user.name}</td>
                <td className="px-4 py-3 text-brown/70">{user.email}</td>
                <td className="px-4 py-3 text-brown/70">{user.role}</td>
                <td className="px-4 py-3 text-brown/70">{user.active ? 'Active' : 'Deactivated'}</td>
                <td className="px-4 py-3 text-brown/70">{formatDate(user.createdAt)}</td>
              </tr>
            ))}
            {firm.users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brown/50">
                  This firm has no users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
