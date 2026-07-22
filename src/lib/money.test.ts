import { describe, it, expect } from 'vitest';
import { formatMoney, formatPercent, formatPercentFromFraction } from '@/lib/money';

describe('formatMoney', () => {
  it('formats numbers, strings, and Decimals as USD', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney('19287.85')).toBe('$19,287.85');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('shows negatives with a leading minus', () => {
    expect(formatMoney(-42)).toBe('-$42.00');
  });
});

describe('formatPercentFromFraction', () => {
  it('converts a fraction to a percent string', () => {
    expect(formatPercentFromFraction('0.07')).toBe('7%');
    expect(formatPercentFromFraction('0.0725')).toBe('7.25%');
  });
});

describe('formatPercent', () => {
  it('formats a value already expressed as a percent', () => {
    expect(formatPercent(15)).toBe('15%');
    expect(formatPercent('12.5')).toBe('12.5%');
  });
});
