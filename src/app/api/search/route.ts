import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { isAdmin, resolvePermissions } from '@/lib/permissions';

export interface SearchResult {
  type: 'page' | 'project' | 'vendor' | 'lead' | 'document' | 'resource';
  label: string;
  sublabel?: string;
  href: string;
}

const STATIC_PAGES: { label: string; sublabel: string; href: string; keywords: string; adminOnly?: boolean }[] = [
  { label: 'Projects', sublabel: 'Page', href: '/app/projects', keywords: 'projects active jobs' },
  { label: 'New Project', sublabel: 'Page', href: '/app/projects/new', keywords: 'new project create job' },
  {
    label: 'Business Development',
    sublabel: 'Page',
    href: '/app/business-development',
    keywords: 'business development leads pipeline crm kanban',
  },
  { label: 'Referral Partners', sublabel: 'Business Development', href: '/app/business-development', keywords: 'referral partners' },
  { label: 'Vendors', sublabel: 'Page', href: '/app/vendors', keywords: 'vendors ffe suppliers showroom rep' },
  { label: 'Administration', sublabel: 'Page', href: '/app/administration', keywords: 'administration storage files' },
  { label: 'Users', sublabel: 'Administration', href: '/app/administration', keywords: 'users teammates accounts', adminOnly: true },
  {
    label: 'Permissions',
    sublabel: 'Administration',
    href: '/app/administration',
    keywords: 'permissions designer role visibility',
    adminOnly: true,
  },
  { label: 'Settings', sublabel: 'Page', href: '/app/settings', keywords: 'settings company logo payment instructions' },
];

export async function GET(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  const admin = isAdmin(session);
  const perms = await resolvePermissions(session);
  const lower = q.toLowerCase();

  const pages: SearchResult[] = STATIC_PAGES.filter((p) => (!p.adminOnly || admin) && p.keywords.includes(lower)).map(
    (p) => ({ type: 'page', label: p.label, sublabel: p.sublabel, href: p.href })
  );

  const [projects, vendors, leads, documents, resources] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { client: { name: { contains: q, mode: 'insensitive' } } }] },
      include: { client: true },
      take: 6,
    }),
    prisma.vendor.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 6 }),
    prisma.lead.findMany({ where: { clientName: { contains: q, mode: 'insensitive' } }, take: 6 }),
    perms.documentsPresentations || perms.contracts
      ? prisma.document.findMany({
          where: { filename: { contains: q, mode: 'insensitive' }, projectId: { not: null } },
          include: { project: true },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.resource.findMany({ where: { filename: { contains: q, mode: 'insensitive' } }, take: 6 }),
  ]);

  const results: SearchResult[] = [
    ...pages,
    ...projects.map((p) => ({
      type: 'project' as const,
      label: p.name,
      sublabel: `Project · ${p.client.name}`,
      href: `/app/projects/${p.id}`,
    })),
    ...vendors.map((v) => ({ type: 'vendor' as const, label: v.name, sublabel: 'Vendor', href: '/app/vendors' })),
    ...leads.map((l) => ({
      type: 'lead' as const,
      label: l.clientName,
      sublabel: 'Lead · Business Development',
      href: '/app/business-development',
    })),
    ...documents
      .filter((d) => d.project && (d.type === 'CONTRACT' ? perms.contracts : perms.documentsPresentations))
      .map((d) => ({
        type: 'document' as const,
        label: d.filename,
        sublabel: `Document · ${d.project!.name}`,
        href: `/app/projects/${d.projectId}`,
      })),
    ...resources.map((r) => ({
      type: 'resource' as const,
      label: r.filename,
      sublabel: `File · Administration / ${r.folder}`,
      href: '/app/administration',
    })),
  ];

  return NextResponse.json({ results: results.slice(0, 30) });
}
