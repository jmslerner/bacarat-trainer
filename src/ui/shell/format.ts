/**
 * Number formatting helpers shared by every view.
 * All functions are pure and safe on non-finite input (they render a dash).
 */
import type { BetLimits, TableRules } from '@/engine';

const moneyWhole = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const moneyCents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface MoneyOptions {
  /** Always show cents (default: only when the amount is not a whole number). */
  cents?: boolean;
  /** Prefix a + sign on positive amounts. */
  signed?: boolean;
  /** Currency symbol (default "$"). */
  symbol?: string;
}

/** $1,000 · $12.50 · -$25 · +$40 (with signed). Non-finite → "—". */
export function formatMoney(amount: number, opts: MoneyOptions = {}): string {
  if (!Number.isFinite(amount)) return '—';
  const symbol = opts.symbol ?? '$';
  const abs = Math.abs(amount);
  const whole = Math.abs(abs - Math.round(abs)) < 1e-9;
  const body = opts.cents || !whole ? moneyCents.format(abs) : moneyWhole.format(abs);
  const sign = amount < 0 && Math.abs(amount) >= 0.005 ? '-' : opts.signed && amount > 0 ? '+' : '';
  return `${sign}${symbol}${body}`;
}

/** Compact money for tight spots: $1K, $2.5K, $1.2M, $750. */
export function formatMoneyCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}$${trimZeros((abs / 1_000_000).toFixed(2))}M`;
  if (abs >= 10_000) return `${sign}$${trimZeros((abs / 1_000).toFixed(1))}K`;
  if (abs >= 1_000) return `${sign}$${trimZeros((abs / 1_000).toFixed(2))}K`;
  return `${sign}$${trimZeros(abs.toFixed(2))}`;
}

/** 0.010183 → "1.02%" (digits default 2). Pass `signed` to show +/-. */
export function formatPercent(fraction: number, digits = 2, signed = false): string {
  if (!Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  const sign = signed && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

/** 1234567 → "1,234,567"; optional fixed decimals. */
export function formatNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** +3 / -2 / 0 with explicit sign (true counts, running counts). */
export function formatSigned(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}

/** Payout "40:1" style label. */
export function formatOdds(toOne: number): string {
  if (!Number.isFinite(toOne)) return '—';
  return `${trimZeros(toOne.toFixed(2))}:1`;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** "$10–$5,000" — a betting range. */
export function formatLimitRange(limits: BetLimits): string {
  return `${formatMoney(limits.min)}–${formatMoney(limits.max)}`;
}

/** "main $10–$5,000 · tie $5–$500 · side $5–$500" — a table's limits in one line. */
export function formatLimits(limits: TableRules['limits']): string {
  return `main ${formatLimitRange(limits.main)} · tie ${formatLimitRange(limits.tie)} · side ${formatLimitRange(limits.side)}`;
}
