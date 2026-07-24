import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { StorageError, type FileStorage, type StorageBucket, type UploadOptions } from './types';

// The Supabase implementation of the FileStorage port. This is the ONLY module
// in the app that may import @supabase/supabase-js — everything else talks to
// the port. Swapping to S3 means adding a sibling file, not editing routes.

/**
 * Domain bucket -> Supabase bucket, and whether it's public.
 *
 * `documents` and `resources` hold confidential client and firm material, so
 * they're private and only ever read through a short-lived signed URL. The
 * logo is not sensitive and is rendered directly in <img> tags and PDFs, so it
 * lives in a public bucket for a stable, permanent URL.
 */
const BUCKETS: Record<StorageBucket, { name: string; public: boolean }> = {
  documents: { name: 'documents', public: false },
  resources: { name: 'resources', public: false },
  branding: { name: 'branding', public: true },
};

/** Server-side Supabase client using the service role key (uploads, signed URLs). */
function defaultClientFactory(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new StorageError(
      'Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function createSupabaseFileStorage(clientFactory: () => SupabaseClient = defaultClientFactory): FileStorage {
  // Buckets we've already confirmed exist this process, so a hot path doesn't
  // re-check on every upload.
  const ensured = new Set<StorageBucket>();

  /** Creates the bucket if it doesn't exist — lets a fresh Supabase project "just work" on first upload. */
  async function ensureBucket(bucket: StorageBucket) {
    if (ensured.has(bucket)) return;
    const { name, public: isPublic } = BUCKETS[bucket];
    const supabase = clientFactory();

    const { data: existing } = await supabase.storage.getBucket(name);
    if (!existing) {
      const { error } = await supabase.storage.createBucket(name, { public: isPublic });
      // Ignore a race where another request created it first.
      if (error && !error.message.toLowerCase().includes('already exists')) {
        throw new StorageError(`Could not create bucket "${name}": ${error.message}`, { cause: error });
      }
    }
    ensured.add(bucket);
  }

  return {
    async upload(bucket: StorageBucket, path: string, body: ArrayBuffer, options?: UploadOptions) {
      await ensureBucket(bucket);
      const { error } = await clientFactory()
        .storage.from(BUCKETS[bucket].name)
        .upload(path, body, { contentType: options?.contentType, upsert: options?.replace ?? false });
      if (error) throw new StorageError(error.message, { cause: error });
    },

    async remove(bucket: StorageBucket, paths: string[]) {
      if (paths.length === 0) return;
      const { error } = await clientFactory().storage.from(BUCKETS[bucket].name).remove(paths);
      if (error) throw new StorageError(error.message, { cause: error });
    },

    async createSignedUrl(bucket: StorageBucket, path: string, expiresInSeconds = 3600) {
      try {
        const { data, error } = await clientFactory()
          .storage.from(BUCKETS[bucket].name)
          .createSignedUrl(path, expiresInSeconds);
        if (error || !data) return null;
        return data.signedUrl;
      } catch {
        return null;
      }
    },

    getPublicUrl(bucket: StorageBucket, path: string) {
      return clientFactory().storage.from(BUCKETS[bucket].name).getPublicUrl(path).data.publicUrl;
    },
  };
}
