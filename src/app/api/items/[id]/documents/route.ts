import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { storage } from '@/server/storage';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const documents = await db.document.findMany({ where: { itemId: params.id }, orderBy: { uploadedAt: 'desc' } });
  const rows = await Promise.all(
    documents.map(async (d) => ({
      id: d.id,
      filename: d.filename,
      type: d.type,
      url: await storage.createSignedUrl('documents', d.storagePath),
      uploadedAt: d.uploadedAt.toISOString(),
    }))
  );
  return NextResponse.json(rows);
}
