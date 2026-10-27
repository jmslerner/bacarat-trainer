/**
 * Effect of removal of each card value on the Dragon 7 and Panda 8 bets (from the engine's exact table), beside
 * the tags each counting system assigns — the tags follow the sign and rough size of the EORs.
 */
import type { ReactNode } from 'react';
import { EOR_8_DECKS } from '@/engine';
import { cx, formatSigned } from '@/ui/shell';
import { Table, tableClass } from '../components';
import type { CountSystemShape } from '../countingData';
import { tagClass } from './CountWalkthrough';
import styles from './Widgets.module.css';

export const CARD_VALUE_LABELS: readonly string[] = ['10 / J / Q / K', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9'];

function EorBar({ value, max }: { value: number; max: number }): ReactNode {
  const pct = max > 0 ? (Math.abs(value) / max) * 50 : 0;
  return (
    <span className={styles.barTrack} style={{ display: 'block', width: 120, height: 10 }} aria-hidden="true">
      <span className={styles.barCenter} style={{ left: '50%' }} />
      <span className={cx(styles.barFill, value >= 0 ? styles.barPos : styles.barNeg)} style={value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }} />
    </span>
  );
}

export interface EorTableProps {
  systems: { dragon7: CountSystemShape; panda8: CountSystemShape };
}

export function EorTable({ systems }: EorTableProps): ReactNode {
  const d7 = EOR_8_DECKS.dragon7;
  const p8 = EOR_8_DECKS.panda8;
  const max = Math.max(...d7.map(Math.abs), ...p8.map(Math.abs));
  const fmt = (v: number): string => `${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(3)}%`;
  return (
    <Table caption="Effect of removing one card from a full 8-deck shoe (change in EV per $1 bet)" compact>
      <thead>
        <tr>
          <th scope="col">Card</th>
          <th scope="col" className={tableClass.num}>
            Dragon 7 EOR
          </th>
          <th scope="col" />
          <th scope="col" className={tableClass.num}>
            D7 tag
          </th>
          <th scope="col" className={tableClass.num}>
            Panda 8 EOR
          </th>
          <th scope="col" />
          <th scope="col" className={tableClass.num}>
            P8 tag
          </th>
        </tr>
      </thead>
      <tbody>
        {CARD_VALUE_LABELS.map((label, v) => (
          <tr key={v}>
            <td className={tableClass.strong}>{label}</td>
            <td className={cx(tableClass.num, d7[v] >= 0 ? 'c-win' : 'c-loss')}>{fmt(d7[v])}</td>
            <td>
              <EorBar value={d7[v]} max={max} />
            </td>
            <td className={cx(tableClass.num, tagClass(systems.dragon7.tags[v]))}>{formatSigned(systems.dragon7.tags[v])}</td>
            <td className={cx(tableClass.num, p8[v] >= 0 ? 'c-win' : 'c-loss')}>{fmt(p8[v])}</td>
            <td>
              <EorBar value={p8[v]} max={max} />
            </td>
            <td className={cx(tableClass.num, tagClass(systems.panda8.tags[v]))}>{formatSigned(systems.panda8.tags[v])}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** The ten tags of a system as a row of tiles. */
export function TagRow({ system }: { system: CountSystemShape }): ReactNode {
  return (
    <div className={styles.tagRow} role="list" aria-label={`${system.name} tags by card value`}>
      {CARD_VALUE_LABELS.map((label, v) => (
        <div key={v} className={styles.tagCell} role="listitem">
          <span className={styles.tagCard}>{v === 0 ? '10/J/Q/K' : v === 1 ? 'A' : label}</span>
          <span className={cx(styles.tagValue, tagClass(system.tags[v]))}>{formatSigned(system.tags[v])}</span>
        </div>
      ))}
    </div>
  );
}
