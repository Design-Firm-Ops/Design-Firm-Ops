import { createSupabaseFileStorage } from './supabase';
import type { FileStorage, StorageBucket } from './types';

export { StorageError, STORAGE_BUCKETS } from './types';
export type { FileStorage, StorageBucket, UploadOptions } from './types';

// The single storage instance the app uses. Swapping providers is a change to
// this one line plus a new adapter module.
export const storage: FileStorage = createSupabaseFileStorage();

/**
 * A collision-resistant object path. Uploads are namespaced by what they belong
 * to (`items/<id>/`, `leads/<id>/`, a project id, a resource folder) and
 * timestamped so re-uploading the same filename doesn't clobber the old object.
 */
export function storagePath(prefix: string, filename: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  return cleanPrefix ? `${cleanPrefix}/${Date.now()}-${filename}` : `${Date.now()}-${filename}`;
}

/**
 * Best-effort delete. An orphaned object is not a reason to fail the request
 * that's removing the row pointing at it — the database is the app's source of
 * truth, and orphans get swept up separately.
 */
export async function removeQuietly(bucket: StorageBucket, path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await storage.remove(bucket, [path]);
  } catch {
    // Intentionally swallowed — see above.
  }
}
