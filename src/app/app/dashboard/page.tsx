import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { summarizeProjectFinancials } from '@/lib/financials';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  LEAD: 'bg-taupe/30 text-brown',
  ACTIVE: 'bg-gold/30 text-brown',
  ON_HOLD: 'bg-red-100 text-red-800',
  COMPLETE: 'bg-green-100 text-green-800',
};

export default async function DashboardPage() {
  const projects = await prisma.project.findMany({
    include: {
      client: true,
      invoices: { include: { items: true } },
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brown">Projects</h1>
        <Link href="/app/projects/new" className="btn-primary">
          New Project
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-semibold uppercase tracking-wide text-brown/60">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Start Date</th>
              <th className="px-4 py-3 text-right">Invoiced</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {projects.map((project) => {
              const { invoicedTotal, paidTotal, outstanding } = summarizeProjectFinancials(project);
              return (
                <tr key={project.id} className="hover:bg-taupe/5">
                  <td className="px-4 py-3">
                    <Link href={`/app/projects/${project.id}`} className="font-medium text-brown hover:text-gold">
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{project.client.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[project.status]}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brown/70">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(invoicedTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(paidTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(outstanding)}</td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brown/50">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
