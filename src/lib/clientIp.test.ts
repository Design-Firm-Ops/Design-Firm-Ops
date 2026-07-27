import { describe, it, expect } from 'vitest';
import { clientIpFrom, UNKNOWN_IP } from '@/lib/clientIp';

const headers = (init: Record<string, string>) => new Headers(init);

describe('clientIpFrom', () => {
  it('takes the leftmost x-forwarded-for entry', () => {
    expect(clientIpFrom(headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })))
      .toBe('203.0.113.7');
  });

  it('trims whitespace', () => {
    expect(clientIpFrom(headers({ 'x-forwarded-for': '  203.0.113.7  ' }))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip', () => {
    expect(clientIpFrom(headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('prefers x-forwarded-for when both are present', () => {
    expect(clientIpFrom(headers({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2' }))).toBe('1.1.1.1');
  });

  // Everyone without a usable header shares one bucket. That is the safe
  // direction for a limiter: they're rate-limited together rather than each
  // getting an unlimited allowance.
  it('buckets callers with no usable header together', () => {
    expect(clientIpFrom(headers({}))).toBe(UNKNOWN_IP);
    expect(clientIpFrom(headers({ 'x-forwarded-for': '' }))).toBe(UNKNOWN_IP);
    expect(clientIpFrom(headers({ 'x-forwarded-for': '   ' }))).toBe(UNKNOWN_IP);
  });
});
