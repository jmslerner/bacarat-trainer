/**
 * The simulated EV of a side bet by true-count bucket (from @/strategy's COUNT_EV_TABLE), with the pooled
 * result at the system's betting threshold.
 */
import type { ReactNode } from 'react';
import { cx, formatMoney, formatNumber, formatPercent, formatSigned } from '@/ui/shell';
import { Facts, Table, tableClass } from '../components';
import type { CountEvRowShape } from '../countingData';
import styles from './Widgets.module.css';

export function bucketLabel(row: CountEvRowShape): string {
  if (row.tcMin === -Infinity) return `below ${formatSigned(row.tcMax)}`;
  if (row.tcMax === Infinity) return `${formatSigned(row.tcMin)} and above`;
  return `${formatSigned(row.tcMin)} to ${formatSigned(row.tcMax)}`;
}

export interface PooledEv {
  hands: number;
  frequency: number;
  ev: number;
  /** Units won per 100 hands dealt, betting one unit whenever the count is at/above the threshold. */
  perHundredHands: number;
}

/** Hands-weighted EV of the buckets at or above `threshold`. */
export function pooledAbove(rows: readonly CountEvRowShape[], threshold: number): PooledEv {
  let hands = 0;
  let frequency = 0;
  let weighted = 0;
  for (const row of rows) {
    if (row.tcMin < threshold) continue;
    hands += row.hands;
    frequency += row.frequency;
    weighted += row.hands * row.ev;
  }
  const ev = hands > 0 ? weighted / hands : 0;
  return { hands, frequency, ev, perHundredHands: frequency * ev * 100 };
}

export interface CountEvTableProps {
  name: string;
  rows: readonly CountEvRowShape[];
  threshold: number;
  /** Side-bet amount for the money columns. */
  amount: number;
  handsPerHour?: number;
}

export function CountEvTable({ name, rows, threshold, amount, handsPerHour = 70 }: CountEvTableProps): ReactNode {
  if (rows.length === 0) {
    return <p className={styles.note}>The simulated table for the {name} is not available in this build.</p>;
  }
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.ev)), 1e-9);
  const pooled = pooledAbove(rows, threshold);
  const totalHands = rows.reduce((s, r) => s + r.hands, 0);
  return (
    <div className={styles.results} data-count-ev={name}>
      <Table caption={`${name}: simulated return by true count (${formatNumber(totalHands)} hands)`} compact>
        <thead>
          <tr>
            <th scope="col">True count</th>
            <th scope="col" className={tableClass.num}>
              Share of hands
            </th>
            <th scope="col" className={tableClass.num}>
              Hands
            </th>
            <th scope="col" className={tableClass.num}>
              EV per $1
            </th>
            <th scope="col">Bet?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const bet = r.tcMin >= threshold;
            const pct = (Math.abs(r.ev) / maxAbs) * 50;
            return (
              <tr key={i} className={cx(bet && tableClass.strong)} data-bucket-bet={bet}>
                <td>{bucketLabel(r)}</td>
                <td className={tableClass.num}>{formatPercent(r.frequency, 1)}</td>
                <td className={tableClass.num}>{formatNumber(r.hands)}</td>
                <td className={tableClass.num}>
                  <span className={styles.bar} style={{ gridTemplateColumns: '110px minmax(0, 1fr)', justifyContent: 'end' }}>
                    <span className={styles.barTrack} style={{ width: 110, height: 10 }} aria-hidden="true">
                      <span className={styles.barCenter} style={{ left: '50%' }} />
                      <span className={cx(styles.barFill, r.ev >= 0 ? styles.barPos : styles.barNeg)} style={r.ev >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }} />
                    </span>
                    <span className={r.ev >= 0 ? 'c-win' : 'c-loss'}>{formatPercent(r.ev, 1, true)}</span>
                  </span>
                </td>
                <td className={bet ? 'c-win' : tableClass.muted}>{bet ? 'Yes' : 'no'}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Facts
        items={[
          { label: `Bet when TC ≥ ${formatSigned(threshold)}`, value: formatPercent(pooled.frequency, 1), sub: 'of all hands dealt' },
          { label: 'EV on those hands', value: formatPercent(pooled.ev, 1, true), sub: 'per $1 wagered', tone: pooled.ev > 0 ? 'positive' : 'negative' },
          { label: 'Per 100 hands dealt', value: formatMoney(pooled.perHundredHands * amount, { signed: true }), sub: `betting ${formatMoney(amount)} when the count says so`, tone: pooled.perHundredHands > 0 ? 'positive' : 'negative' },
          { label: 'Per hour', value: formatMoney((pooled.perHundredHands / 100) * handsPerHour * amount, { signed: true }), sub: `${handsPerHour} hands per hour`, tone: pooled.perHundredHands > 0 ? 'positive' : 'negative' },
        ]}
      />
    </div>
  );
}
