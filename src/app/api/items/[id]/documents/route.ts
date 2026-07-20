import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { createSignedDocumentUrl } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const documents = await prisma.document.findMany({ where: { itemId: params.id }, orderBy: { uploadedAt: 'desc' } });
  const rows = await Promise.all(
    documents.map(async (d) => ({
      id: d.id,
      filename: d.filename,
      type: d.type,
      url: await createSignedDocumentUrl(d.storagePath),
      uploadedAt: d.uploadedAt.toISOString(),
    }))
  );
  return NextResponse.json(rows);
}
