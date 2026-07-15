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

export const DOCUMENTS_BUCKET = 'documents';
