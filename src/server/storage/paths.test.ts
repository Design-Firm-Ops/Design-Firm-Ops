import { describe, it, expect, vi, afterEach } from 'vitest';
import { storagePath, removeQuietly } from '@/server/storage';
import * as storageModule from '@/server/storage';
import { StorageError } from '@/server/storage/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storagePath', () => {
  it('namespaces by prefix and timestamps the filename', () => {
    const path = storagePath('items/abc', 'quote.pdf');
    expect(path).toMatch(/^items\/abc\/\d+-quote\.pdf$/);
  });

  it('omits the leading slash when there is no prefix', () => {
    expect(storagePath('', 'logo.png')).toMatch(/^\d+-logo\.png$/);
  });

  it('normalises stray slashes so paths never double up', () => {
    expect(storagePath('/leads/1/', 'a.pdf')).toMatch(/^leads\/1\/\d+-a\.pdf$/);
  });

  // Re-uploading the same filename must not clobber the previous object.
  it('produces a different path for the same filename over time', async () => {
    const first = storagePath('p', 'same.pdf');
    await new Promise((resolve) => setTimeout(resolve, 2));
    expect(storagePath('p', 'same.pdf')).not.toBe(first);
  });

  it('keeps the original filename visible for humans', () => {
    expect(storagePath('x', 'Floor Plan v2.pdf')).toContain('Floor Plan v2.pdf');
  });
});

describe('removeQuietly', () => {
  it('does nothing when there is no path to remove', async () => {
    const remove = vi.spyOn(storageModule.storage, 'remove');
    await removeQuietly('documents', null);
    await removeQuietly('documents', undefined);
    await removeQuietly('documents', '');
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes a real path through the port', async () => {
    const remove = vi.spyOn(storageModule.storage, 'remove').mockResolvedValue();
    await removeQuietly('resources', 'folder/file.pdf');
    expect(remove).toHaveBeenCalledWith('resources', ['folder/file.pdf']);
  });

  // The whole point: an orphaned object must not fail the request that is
  // deleting the row pointing at it.
  it('swallows a storage failure rather than rejecting', async () => {
    vi.spyOn(storageModule.storage, 'remove').mockRejectedValue(new StorageError('provider down'));
    await expect(removeQuietly('documents', 'a/b.pdf')).resolves.toBeUndefined();
  });
});
