import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Stat.module.css';

export type StatTone = 'neutral' | 'positive' | 'negative' | 'gold' | 'banker' | 'player' | 'tie';

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  /** Secondary line (e.g. "per 100 hands"). */
  sub?: ReactNode;
  tone?: StatTone;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center' | 'right';
  /** Boxed card look (default) or inline figure. */
  boxed?: boolean;
  className?: string;
  title?: string;
}

/** Tone for a signed money/number figure. */
export function toneForNet(n: number): StatTone {
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return 'neutral';
  return n > 0 ? 'positive' : 'negative';
}

/** A casino-display figure: small-caps gold label over a tabular value. */
export function Stat({ label, value, sub, tone = 'neutral', size = 'md', align = 'left', boxed = true, className, title }: StatProps): ReactNode {
  return (
    <div className={cx(styles.stat, boxed && styles.boxed, styles[size], styles[`align-${align}`], styles[tone], className)} title={title}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {sub !== undefined && <span className={styles.sub}>{sub}</span>}
    </div>
  );
}
