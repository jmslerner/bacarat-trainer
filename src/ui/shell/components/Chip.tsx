/**
 * Chip / ChipStack — CSS casino chips with edge spots and an inner ring, coloured by
 * denomination (US conventions: $1 white, $5 red, $25 green, $100 black, $500 purple,
 * $1,000 orange "pumpkin", $5,000 brown, $25,000 grey, $100,000 a gold plaque).
 * Faces read 1 · 5 · 25 · 100 · 500 · 1K · 5K · 25K · 100K so they fit at every size.
 */
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { formatMoney } from '../format';
import styles from './Chip.module.css';

export interface ChipColor {
  /** Face / body colour. */
  base: string;
  /** Edge-spot and inner-ring colour. */
  edge: string;
  /** Text colour on the face. */
  ink: string;
  name: string;
  /** Lighter centre of the face (a plaque's sheen); the face is flat when omitted. */
  sheen?: string;
  /** A solid rim instead of edge spots (the $100,000 plaque). */
  solidEdge?: boolean;
}

export const CHIP_COLORS: Readonly<Record<string, ChipColor>> = {
  '0.5': { base: '#f0d9e6', edge: '#9c3b6f', ink: '#3a1024', name: 'pink' },
  '1': { base: '#f4f1ea', edge: '#2a5bb8', ink: '#1c1a17', name: 'white' },
  '2.5': { base: '#f2a7c3', edge: '#ffffff', ink: '#3a1024', name: 'pink' },
  '5': { base: '#c8102e', edge: '#f4f1ea', ink: '#ffffff', name: 'red' },
  '10': { base: '#1f5fbf', edge: '#f4f1ea', ink: '#ffffff', name: 'blue' },
  '20': { base: '#e8c547', edge: '#3a2e0a', ink: '#2b2104', name: 'yellow' },
  '25': { base: '#1d8a4b', edge: '#f4f1ea', ink: '#ffffff', name: 'green' },
  '50': { base: '#e3651d', edge: '#f4f1ea', ink: '#ffffff', name: 'orange' },
  '100': { base: '#1c1a17', edge: '#f4f1ea', ink: '#ffffff', name: 'black' },
  '500': { base: '#6a2c91', edge: '#efe3f8', ink: '#ffffff', name: 'purple' },
  '1000': { base: '#f6a21e', edge: '#1c1a17', ink: '#1c1a17', name: 'pumpkin' },
  '5000': { base: '#6b3f22', edge: '#e9c9a3', ink: '#ffffff', name: 'brown' },
  '25000': { base: '#b4bac2', edge: '#1c1a17', ink: '#1c1a17', name: 'gray' },
  '100000': { base: '#e2bf55', sheen: '#f9ecb8', edge: '#7a5a12', ink: '#2b2104', name: 'gold', solidEdge: true },
};

const FALLBACK_COLOR: ChipColor = { base: '#8d8d8d', edge: '#f4f1ea', ink: '#ffffff', name: 'gray' };

/** Casino colour for a denomination (exact match, else a neutral chip). */
export function chipColor(value: number): ChipColor {
  return CHIP_COLORS[String(value)] ?? FALLBACK_COLOR;
}

/** Face label: 1 → "1", 2.5 → "2.50", 1000 → "1K", 2500 → "2.5K", 100000 → "100K". */
export function chipLabel(value: number): string {
  if (!Number.isFinite(value)) return '?';
  if (value >= 1000 && Number.isInteger(value)) return `${Math.round((value / 1000) * 100) / 100}K`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Break an amount into chips, largest first (what a dealer would push out).
 * A remainder smaller than the smallest denomination is shown as one smallest chip when it is
 * at least half of it, so odd payouts (commission) still read as money on the felt.
 */
export function amountToChips(amount: number, denominations: readonly number[]): number[] {
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const denoms = [...denominations].filter((d) => Number.isFinite(d) && d > 0).sort((a, b) => b - a);
  if (denoms.length === 0) return [];
  const out: number[] = [];
  let rest = amount;
  for (const d of denoms) {
    const n = Math.floor((rest + 1e-9) / d);
    for (let i = 0; i < n; i++) out.push(d);
    rest -= n * d;
  }
  const smallest = denoms[denoms.length - 1];
  if (rest >= smallest / 2 - 1e-9) out.push(smallest);
  return out;
}

export type ChipSize = 'xs' | 'sm' | 'md' | 'lg';
export const CHIP_SIZES: Readonly<Record<ChipSize, number>> = { xs: 28, sm: 36, md: 48, lg: 64 };

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'children'> {
  value: number;
  size?: ChipSize | number;
  /** Raised with a gold ring — the chip currently in hand. */
  selected?: boolean;
  /** Render as a non-interactive image (default when no onClick is passed). */
  interactive?: boolean;
  /** Accessible name override. */
  label?: string;
}

function chipVars(value: number, px: number): CSSProperties {
  const c = chipColor(value);
  return { '--chip-size': `${px}px`, '--chip-base': c.base, '--chip-sheen': c.sheen ?? c.base, '--chip-edge': c.edge, '--chip-ink': c.ink } as CSSProperties;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { value, size = 'md', selected, interactive, label, className, style, onClick, disabled, ...rest },
  ref,
) {
  const px = typeof size === 'number' ? size : CHIP_SIZES[size];
  const text = chipLabel(value);
  const name = label ?? `${formatMoney(value)} chip`;
  const isButton = interactive ?? Boolean(onClick);
  const solidEdge = chipColor(value).solidEdge ? '' : undefined;
  const cls = cx(styles.chip, selected && styles.selected, isButton && styles.interactive, disabled && styles.disabled, className);
  const face = (
    <span className={styles.value} data-len={text.length} aria-hidden="true">
      {text}
    </span>
  );
  const vars = { ...chipVars(value, px), ...style };

  if (isButton) {
    return (
      <button
        ref={ref}
        type="button"
        className={cls}
        style={vars}
        aria-label={name}
        aria-pressed={selected !== undefined ? selected : undefined}
        onClick={onClick}
        disabled={disabled}
        data-value={value}
        data-solid-edge={solidEdge}
        {...rest}
      >
        {face}
      </button>
    );
  }
  return (
    <span className={cls} style={vars} role="img" aria-label={name} data-value={value} data-solid-edge={solidEdge} {...(rest as HTMLAttributes<HTMLSpanElement>)}>
      {face}
    </span>
  );
});

export interface ChipStackProps {
  /** Explicit chips, bottom first (e.g. the per-spot chip stack as placed). */
  chips?: readonly number[];
  /** Or an amount, broken into chips with `denominations`. */
  amount?: number;
  denominations?: readonly number[];
  size?: ChipSize | number;
  /** Cap on drawn chips; the total still reflects every chip. */
  maxVisible?: number;
  /** Show the total as a pill under the stack. */
  showTotal?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
  /** Extra content rendered inside the stack (e.g. a payout badge). */
  children?: ReactNode;
}

const DEFAULT_DENOMS: readonly number[] = [1, 5, 25, 100, 500, 1000, 5000];

export function ChipStack({ chips, amount, denominations = DEFAULT_DENOMS, size = 'md', maxVisible = 12, showTotal = false, label, className, style, children }: ChipStackProps): ReactNode {
  const list = chips ?? (amount !== undefined ? amountToChips(amount, denominations) : []);
  const total = chips ? chips.reduce((s, c) => s + c, 0) : amount ?? 0;
  const px = typeof size === 'number' ? size : CHIP_SIZES[size];
  const offset = Math.max(2, Math.round(px * 0.085));
  const visible = list.length > maxVisible ? list.slice(list.length - maxVisible) : list;
  const height = px + Math.max(0, visible.length - 1) * offset;
  const name = label ?? (list.length === 0 ? 'No chips' : `${formatMoney(total)} in chips`);

  return (
    <div
      className={cx(styles.stack, className)}
      style={{ '--chip-size': `${px}px`, ...style } as CSSProperties}
      role="img"
      aria-label={name}
      data-total={total}
      data-count={list.length}
    >
      <div className={styles.column} style={{ height }}>
        {visible.map((v, i) => (
          <Chip key={i} value={v} size={px} className={styles.stacked} style={{ transform: `translateY(${-i * offset}px)`, zIndex: i + 1 }} />
        ))}
      </div>
      {showTotal && list.length > 0 && <span className={styles.total}>{formatMoney(total)}</span>}
      {children}
    </div>
  );
}
