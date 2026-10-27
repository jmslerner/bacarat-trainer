/**
 * The full Banker third-card table, generated from the engine's `bankerDraws` so it can never drift from the
 * rules the table plays by.
 */
import type { ReactNode } from 'react';
import { bankerDraws } from '@/engine';
import { cx } from '@/ui/shell';
import styles from './Widgets.module.css';

const P3_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const BANKER_TOTALS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export interface ThirdCardTableProps {
  /** Highlight one Banker row. */
  bankerTotal?: number | null;
  /** Highlight one Player-third-card column (null = the "Player stood" column). */
  playerThird?: number | null | undefined;
  compact?: boolean;
}

export function ThirdCardTable({ bankerTotal = null, playerThird, compact }: ThirdCardTableProps): ReactNode {
  const hot = (bt: number, p3: number | null): boolean => bankerTotal === bt && playerThird !== undefined && playerThird === p3;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={styles.ruleGrid} data-widget="third-card-table">
        <caption className="sr-only">Banker third-card rule: rows are the Banker two-card total, columns the value of the Player third card</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.rowHead}>
              Banker has
            </th>
            <th scope="col" title="The Player stood on 6 or 7">
              <span className={cx(styles.thFull, compact && styles.thHidden)}>Player stood</span>
              <span className={cx(styles.thShort, compact && styles.thForce)} aria-hidden="true">
                P stood
              </span>
            </th>
            {P3_VALUES.map((v) => (
              <th key={v} scope="col" title={`Player's third card is a ${v}`} aria-label={`Player third card ${v}`}>
                <span className={cx(styles.thFull, compact && styles.thHidden)}>P3 = {v}</span>
                <span className={cx(styles.thShort, compact && styles.thForce)} aria-hidden="true">
                  {v}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BANKER_TOTALS.map((bt) => (
            <tr key={bt}>
              <th scope="row" className={styles.rowHead}>
                {bt}
              </th>
              <td className={cx(styles.ruleCell, bankerDraws(bt, null) ? styles.cellDraw : styles.cellStand, hot(bt, null) && styles.cellHot)} aria-label={bankerDraws(bt, null) ? 'draws' : 'stands'}>
                {bankerDraws(bt, null) ? 'D' : 'S'}
              </td>
              {P3_VALUES.map((v) => {
                const d = bankerDraws(bt, v);
                return (
                  <td key={v} className={cx(styles.ruleCell, d ? styles.cellDraw : styles.cellStand, hot(bt, v) && styles.cellHot)} aria-label={d ? 'draws' : 'stands'}>
                    {d ? 'D' : 'S'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th scope="row" className={styles.rowHead}>
              8, 9
            </th>
            <td className={cx(styles.ruleCell, styles.cellNatural)} colSpan={11}>
              Natural — the Banker stands and the Player never draws
            </td>
          </tr>
        </tbody>
      </table>
      <div className={styles.legend} style={{ marginTop: 8 }}>
        <span>
          <span className={cx(styles.swatch, styles.cellDraw)} aria-hidden="true" /> D = Banker draws
        </span>
        <span>
          <span className={cx(styles.swatch, styles.cellStand)} aria-hidden="true" /> S = Banker stands
        </span>
      </div>
    </div>
  );
}
