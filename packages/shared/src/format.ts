import type { Money } from './types';

const MINUS = '−';

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

export function formatMoney(n: Money): string {
  const sign = n < 0 ? MINUS : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${trim(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}$${trim(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}k`;
  return `${sign}$${Math.round(a)}`;
}

export function formatPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function formatPax(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
