import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { badRequest } from '@/lib/apiRoute';
import { storage, storagePath } from '@/server/storage';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

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

  const settings = await db.settings.upsert({
    where: { firmId },
    create: { companyName: 'Madison Ditton Interiors', logoUrl, firmId },
    update: { logoUrl },
  });

  return NextResponse.json(settings);
}
