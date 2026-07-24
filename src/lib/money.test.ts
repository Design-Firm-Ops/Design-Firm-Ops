import { describe, it, expect } from 'vitest';
import { formatMoney, formatPercent, formatPercentFromFraction, sumMoney } from '@/lib/money';

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

describe('sumMoney', () => {
  it('sums to the cent', () => {
    expect(sumMoney(['10.10', '20.20', '30.30']).toFixed(2)).toBe('60.60');
  });

  it('is zero for an empty list', () => {
    expect(sumMoney([]).toFixed(2)).toBe('0.00');
  });

  // The reason this exists: 0.1 + 0.2 is 0.30000000000000004 in float math.
  it('does not drift the way floating-point addition does', () => {
    expect(sumMoney(['0.1', '0.2']).toFixed(2)).toBe('0.30');
    expect(sumMoney(Array(10).fill('0.1')).toFixed(2)).toBe('1.00');
    expect(sumMoney(Array(10).fill('0.1')).equals(1)).toBe(true);
  });
});
