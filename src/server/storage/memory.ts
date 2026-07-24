import { StorageError, type FileStorage, type StorageBucket, type UploadOptions } from './types';

// An in-memory FileStorage. This is the reason the port exists: before it,
// nothing that touched uploads could be tested without a live Supabase.

interface StoredObject {
  body: ArrayBuffer;
  contentType?: string;
}

export interface MemoryFileStorage extends FileStorage {
  /** Every object currently stored, keyed `bucket/path` — for assertions. */
  readonly objects: Map<string, StoredObject>;
  /** Force the next call of a given kind to fail, to exercise error paths. */
  failNext(operation: 'upload' | 'remove' | 'createSignedUrl', message?: string): void;
}

export function createMemoryFileStorage(): MemoryFileStorage {
  const objects = new Map<string, StoredObject>();
  const failures = new Map<string, string>();

  const key = (bucket: StorageBucket, path: string) => `${bucket}/${path}`;

  function consumeFailure(operation: string) {
    const message = failures.get(operation);
    if (message === undefined) return;
    failures.delete(operation);
    throw new StorageError(message);
  }

  return {
    objects,

    failNext(operation, message = `${operation} failed`) {
      failures.set(operation, message);
    },

    async upload(bucket: StorageBucket, path: string, body: ArrayBuffer, options?: UploadOptions) {
      consumeFailure('upload');
      if (objects.has(key(bucket, path)) && !options?.replace) {
        throw new StorageError(`Object already exists at ${key(bucket, path)}`);
      }
      objects.set(key(bucket, path), { body, contentType: options?.contentType });
    },

    async remove(bucket: StorageBucket, paths: string[]) {
      consumeFailure('remove');
      for (const path of paths) objects.delete(key(bucket, path));
    },

    async createSignedUrl(bucket: StorageBucket, path: string, expiresInSeconds = 3600) {
      try {
        consumeFailure('createSignedUrl');
      } catch {
        // Matches the real adapter: a failure to mint a URL surfaces as null.
        return null;
      }
      if (!objects.has(key(bucket, path))) return null;
      return `memory://${key(bucket, path)}?expires=${expiresInSeconds}`;
    },

    getPublicUrl(bucket: StorageBucket, path: string) {
      return `memory://public/${key(bucket, path)}`;
    },
  };
}
