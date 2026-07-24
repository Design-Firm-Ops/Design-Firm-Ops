import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

const VALID_KEY = randomBytes(32).toString('base64');

beforeAll(() => {
  // A valid 32-byte base64 key so getKey() succeeds regardless of the
  // developer's real .env.
  process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;
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

// The misconfiguration paths. Vendor trade-account passwords are the only
// secrets this app stores, so a bad key must fail loudly and immediately
// rather than silently encrypting with something weak.
describe('key validation', () => {
  it('refuses to run without a key at all', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encryptSecret('x')).toThrow(/CREDENTIALS_ENCRYPTION_KEY is not set/);
    expect(() => decryptSecret('a:b:c')).toThrow(/CREDENTIALS_ENCRYPTION_KEY is not set/);
  });

  it('refuses an empty key rather than treating it as absent-but-fine', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = '';
    expect(() => encryptSecret('x')).toThrow(/CREDENTIALS_ENCRYPTION_KEY is not set/);
  });

  it('refuses a key that does not decode to exactly 32 bytes', () => {
    for (const tooShort of [randomBytes(16), randomBytes(31)]) {
      process.env.CREDENTIALS_ENCRYPTION_KEY = tooShort.toString('base64');
      expect(() => encryptSecret('x')).toThrow(/exactly 32 bytes/);
    }

    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(33).toString('base64');
    expect(() => encryptSecret('x')).toThrow(/exactly 32 bytes/);
  });

  it('tells the developer how to generate a valid key', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encryptSecret('x')).toThrow(/openssl rand -base64 32/);
  });

  // A secret encrypted under one key must not be readable under another.
  it('cannot decrypt a secret written under a different key', () => {
    const blob = encryptSecret('vendor-login');
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => decryptSecret(blob)).toThrow();
  });
});
