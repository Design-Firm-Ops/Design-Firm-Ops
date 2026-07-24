import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { badRequest } from '@/lib/apiRoute';
import { storage, storagePath } from '@/server/storage';

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return badRequest('file is required');
  }

  let logoUrl: string;
  try {
    const path = storagePath('', `logo-${file.name}`);
    await storage.upload('branding', path, await file.arrayBuffer(), {
      contentType: file.type,
      replace: true,
    });
    logoUrl = storage.getPublicUrl('branding', path);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, companyName: 'Madison Ditton Interiors', logoUrl },
    update: { logoUrl },
  });

  return NextResponse.json(settings);
}
