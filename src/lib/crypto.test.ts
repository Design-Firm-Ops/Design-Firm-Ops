import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

beforeAll(() => {
  // A valid 32-byte base64 key so getKey() succeeds regardless of the
  // developer's real .env.
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext secret', () => {
    const secret = 'trade-account-hunter2';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same input');
    const b = encryptSecret('same input');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it('emits the iv:authTag:ciphertext blob format', () => {
    const parts = encryptSecret('x').split(':');
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => p.length > 0)).toBe(true);
  });

  it('rejects a tampered ciphertext (GCM auth tag mismatch)', () => {
    const blob = encryptSecret('do not tamper');
    const [iv, tag, ct] = blob.split(':');
    // Flip the ciphertext to a different valid-base64 value.
    const tampered = [iv, tag, Buffer.from('tampered-bytes').toString('base64')].join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('rejects a malformed blob', () => {
    expect(() => decryptSecret('not-a-valid-blob')).toThrow('Malformed encrypted secret');
  });
});
