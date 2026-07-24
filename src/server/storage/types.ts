// The file-storage port.
//
// Nothing outside `src/server/storage/` should know that Supabase is what
// currently backs this. The interface is expressed in the app's terms — named
// buckets, paths, ArrayBuffers — and it *throws* on failure rather than
// returning a vendor-shaped `{ data, error }` pair, so callers use ordinary
// try/catch.

/**
 * The app's storage areas. These are domain concepts, not vendor bucket names;
 * mapping them onto a provider's buckets is the adapter's job.
 *
 * - `documents`  — client documents: contracts, vendor invoices, presentations,
 *                  item photos. Private; only ever read via a signed URL.
 * - `resources`  — firm-wide templates and marketing material. Private.
 * - `branding`   — the company logo. Public, because it's embedded in invoice
 *                  PDFs and emails that need a stable, permanent URL.
 */
export const STORAGE_BUCKETS = ['documents', 'resources', 'branding'] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

export interface UploadOptions {
  contentType?: string;
  /** Overwrite an existing object at the same path instead of failing. */
  replace?: boolean;
}

/** Thrown by any adapter when the underlying provider fails. */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export interface FileStorage {
  /** Writes `body` to `path`. Throws `StorageError` if the provider rejects it. */
  upload(bucket: StorageBucket, path: string, body: ArrayBuffer, options?: UploadOptions): Promise<void>;

  /** Deletes objects. Throws `StorageError` on failure — see `removeQuietly` for best-effort deletes. */
  remove(bucket: StorageBucket, paths: string[]): Promise<void>;

  /**
   * A short-lived URL for a private object, or `null` if one can't be minted.
   * Returning null rather than throwing is deliberate: a missing thumbnail
   * shouldn't take down the page that lists it.
   */
  createSignedUrl(bucket: StorageBucket, path: string, expiresInSeconds?: number): Promise<string | null>;

  /** A permanent URL. Only meaningful for a public bucket (`branding`). */
  getPublicUrl(bucket: StorageBucket, path: string): string;
}
