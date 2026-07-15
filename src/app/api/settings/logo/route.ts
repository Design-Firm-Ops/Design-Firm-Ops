import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { getSupabaseServerClient, LOGO_BUCKET, ensureLogoBucket } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  let logoUrl: string;
  try {
    await ensureLogoBucket();
    const supabase = getSupabaseServerClient();
    const path = `logo-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    logoUrl = data.publicUrl;
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
