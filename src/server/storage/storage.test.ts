import { describe, it, expect, vi } from 'vitest';
import { createMemoryFileStorage } from './memory';
import { createSupabaseFileStorage } from './supabase';
import { StorageError } from './types';

const body = () => new TextEncoder().encode('hello').buffer as ArrayBuffer;

describe('memory FileStorage', () => {
  it('round-trips an upload', async () => {
    const storage = createMemoryFileStorage();
    await storage.upload('documents', 'a/b.pdf', body(), { contentType: 'application/pdf' });

    expect(storage.objects.get('documents/a/b.pdf')?.contentType).toBe('application/pdf');
    expect(await storage.createSignedUrl('documents', 'a/b.pdf')).toContain('documents/a/b.pdf');
  });

  it('keeps buckets separate', async () => {
    const storage = createMemoryFileStorage();
    await storage.upload('documents', 'same.pdf', body());
    await storage.upload('resources', 'same.pdf', body());

    expect(storage.objects.size).toBe(2);
    await storage.remove('documents', ['same.pdf']);
    expect(storage.objects.has('resources/same.pdf')).toBe(true);
  });

  it('refuses to overwrite unless asked', async () => {
    const storage = createMemoryFileStorage();
    await storage.upload('branding', 'logo.png', body());

    await expect(storage.upload('branding', 'logo.png', body())).rejects.toThrow(StorageError);
    await expect(storage.upload('branding', 'logo.png', body(), { replace: true })).resolves.toBeUndefined();
  });

  it('returns null rather than throwing for an unsignable object', async () => {
    const storage = createMemoryFileStorage();
    expect(await storage.createSignedUrl('documents', 'missing.pdf')).toBeNull();

    await storage.upload('documents', 'there.pdf', body());
    storage.failNext('createSignedUrl');
    expect(await storage.createSignedUrl('documents', 'there.pdf')).toBeNull();
  });

  it('surfaces an upload failure as StorageError', async () => {
    const storage = createMemoryFileStorage();
    storage.failNext('upload', 'disk full');
    await expect(storage.upload('documents', 'x.pdf', body())).rejects.toThrow('disk full');
  });
});

// A fake shaped like the slice of supabase-js the adapter uses.
function fakeSupabase(overrides: Record<string, unknown> = {}) {
  const calls: { op: string; bucket: string; args: unknown[] }[] = [];
  let currentBucket = '';

  const from = vi.fn((bucket: string) => {
    currentBucket = bucket;
    return {
      upload: vi.fn(async (...args: unknown[]) => {
        calls.push({ op: 'upload', bucket: currentBucket, args });
        return (overrides.uploadResult as { error: unknown }) ?? { error: null };
      }),
      remove: vi.fn(async (...args: unknown[]) => {
        calls.push({ op: 'remove', bucket: currentBucket, args });
        return (overrides.removeResult as { error: unknown }) ?? { error: null };
      }),
      createSignedUrl: vi.fn(async (...args: unknown[]) => {
        calls.push({ op: 'createSignedUrl', bucket: currentBucket, args });
        return (
          (overrides.signedResult as object) ?? { data: { signedUrl: 'https://signed.test/x' }, error: null }
        );
      }),
      getPublicUrl: vi.fn((path: string) => {
        calls.push({ op: 'getPublicUrl', bucket: currentBucket, args: [path] });
        return { data: { publicUrl: `https://public.test/${currentBucket}/${path}` } };
      }),
    };
  });

  const client = {
    storage: {
      from,
      getBucket: vi.fn(async () => (overrides.bucketExists === false ? { data: null } : { data: { name: 'x' } })),
      createBucket: vi.fn(async () => ({ error: (overrides.createBucketError as unknown) ?? null })),
    },
  };
  return { client, calls };
}

describe('supabase FileStorage adapter', () => {
  it('maps domain buckets onto Supabase bucket names', async () => {
    const { client, calls } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.upload('documents', 'a.pdf', body());
    await storage.upload('resources', 'b.pdf', body());
    await storage.upload('branding', 'c.png', body());

    expect(calls.filter((c) => c.op === 'upload').map((c) => c.bucket)).toEqual([
      'documents',
      'resources',
      'branding',
    ]);
  });

  it('translates a Supabase { error } result into StorageError', async () => {
    const { client } = fakeSupabase({ uploadResult: { error: { message: 'quota exceeded' } } });
    const storage = createSupabaseFileStorage(() => client as never);

    await expect(storage.upload('documents', 'a.pdf', body())).rejects.toThrow(StorageError);
    await expect(storage.upload('documents', 'a.pdf', body())).rejects.toThrow('quota exceeded');
  });

  it('passes contentType through and defaults upsert to false', async () => {
    const { client, calls } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.upload('documents', 'a.pdf', body(), { contentType: 'application/pdf' });
    expect(calls[0].args[2]).toEqual({ contentType: 'application/pdf', upsert: false });

    await storage.upload('branding', 'logo.png', body(), { replace: true });
    expect((calls[1].args[2] as { upsert: boolean }).upsert).toBe(true);
  });

  it('creates a missing bucket with the right visibility', async () => {
    const { client } = fakeSupabase({ bucketExists: false });
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.upload('documents', 'a.pdf', body());
    expect(client.storage.createBucket).toHaveBeenCalledWith('documents', { public: false });

    await storage.upload('branding', 'logo.png', body());
    expect(client.storage.createBucket).toHaveBeenCalledWith('branding', { public: true });
  });

  it('tolerates a concurrent bucket creation', async () => {
    const { client } = fakeSupabase({
      bucketExists: false,
      createBucketError: { message: 'The resource already exists' },
    });
    const storage = createSupabaseFileStorage(() => client as never);
    await expect(storage.upload('documents', 'a.pdf', body())).resolves.toBeUndefined();
  });

  it('only checks a bucket once per process', async () => {
    const { client } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.upload('documents', 'a.pdf', body());
    await storage.upload('documents', 'b.pdf', body());
    expect(client.storage.getBucket).toHaveBeenCalledTimes(1);
  });

  it('returns null when a signed URL cannot be minted', async () => {
    const { client } = fakeSupabase({ signedResult: { data: null, error: { message: 'nope' } } });
    const storage = createSupabaseFileStorage(() => client as never);
    expect(await storage.createSignedUrl('documents', 'a.pdf')).toBeNull();
  });

  it('skips the provider call entirely when removing nothing', async () => {
    const { client, calls } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.remove('documents', []);
    expect(calls).toHaveLength(0);
  });

  it('builds a public URL for the branding bucket', () => {
    const { client } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);
    expect(storage.getPublicUrl('branding', 'logo.png')).toBe('https://public.test/branding/logo.png');
  });
});

describe('supabase adapter — failure paths', () => {
  it('reports a bucket it could not create', async () => {
    const { client } = fakeSupabase({
      bucketExists: false,
      createBucketError: { message: 'insufficient privileges' },
    });
    const storage = createSupabaseFileStorage(() => client as never);

    await expect(storage.upload('documents', 'a.pdf', body())).rejects.toThrow(StorageError);
    await expect(storage.upload('resources', 'a.pdf', body())).rejects.toThrow(/insufficient privileges/);
  });

  it('translates a failed delete into StorageError', async () => {
    const { client } = fakeSupabase({ removeResult: { error: { message: 'object locked' } } });
    const storage = createSupabaseFileStorage(() => client as never);

    await expect(storage.remove('documents', ['a.pdf'])).rejects.toThrow(/object locked/);
  });

  it('returns null when the provider throws while signing', async () => {
    const storage = createSupabaseFileStorage(() => {
      throw new Error('not configured');
    });
    // A missing thumbnail must not take down the page that lists it.
    expect(await storage.createSignedUrl('documents', 'a.pdf')).toBeNull();
  });

  it('passes the requested expiry through', async () => {
    const { client, calls } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.createSignedUrl('documents', 'a.pdf', 60);
    expect(calls.find((c) => c.op === 'createSignedUrl')!.args).toEqual(['a.pdf', 60]);
  });

  it('defaults the expiry to an hour', async () => {
    const { client, calls } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.createSignedUrl('documents', 'a.pdf');
    expect(calls.find((c) => c.op === 'createSignedUrl')!.args).toEqual(['a.pdf', 3600]);
  });

  it('removes several objects in one call', async () => {
    const { client, calls } = fakeSupabase();
    const storage = createSupabaseFileStorage(() => client as never);

    await storage.remove('resources', ['a.pdf', 'b.pdf']);
    expect(calls[0].args[0]).toEqual(['a.pdf', 'b.pdf']);
  });
});
