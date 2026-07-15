import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Server-side Supabase client using the service role key (uploads, signed URLs). */
export function getSupabaseServerClient() {
  if (!url || !serviceKey) {
    throw new Error('Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Contracts, vendor invoices, and presentations are confidential client
// documents — this bucket is private; access only ever happens via a
// short-lived signed URL minted for a signed-in internal user.
export const DOCUMENTS_BUCKET = 'documents';

// The company logo is not sensitive and is rendered directly in <img>
// tags/PDFs, so it lives in a public bucket for a stable, permanent URL.
export const LOGO_BUCKET = 'branding';

/** Creates the bucket if it doesn't exist yet — lets a fresh Supabase project "just work" on first upload. */
async function ensureBucket(bucketName: string, isPublic: boolean) {
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase.storage.getBucket(bucketName);
  if (existing) return;

  const { error } = await supabase.storage.createBucket(bucketName, { public: isPublic });
  // Ignore a race where another request created it first.
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw error;
  }
}

export async function ensureDocumentsBucket() {
  await ensureBucket(DOCUMENTS_BUCKET, false);
}

export async function ensureLogoBucket() {
  await ensureBucket(LOGO_BUCKET, true);
}

/** Mints a short-lived signed URL for a private document object. Returns null if it can't be generated (missing file, storage unreachable, etc). */
export async function createSignedDocumentUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
