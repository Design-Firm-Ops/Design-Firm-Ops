import Decimal from 'decimal.js';

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats any Decimal/number/string as "$1,234.56". */
export function formatMoney(value: Decimal.Value): string {
  return formatter.format(new Decimal(value).toNumber());
}

/** Formats a fraction (0.07) as a percent string ("7%" or "7.25%"). */
export function formatPercentFromFraction(fraction: Decimal.Value): string {
  const pct = new Decimal(fraction).times(100);
  return `${pct.toDP(4).toNumber()}%`;
}

/** Formats a percentage value already expressed as e.g. 15 -> "15%". */
export function formatPercent(pct: Decimal.Value): string {
  return `${new Decimal(pct).toDP(3).toNumber()}%`;
}
