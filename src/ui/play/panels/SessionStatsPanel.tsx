/**
 * SessionStatsPanel — wins/losses by bet type, biggest win and loss, peak/low bankroll, drawdown, commission.
 * The Dragon 7 / Panda 8 counters pulse once each time they go up.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SessionStats } from '@/engine';
import { BET_LABELS, BET_TYPES } from '@/engine';
import { Stat, cx, formatMoney, toneForNet } from '@/ui/shell';
import styles from './Panels.module.css';

/**
 * A counter that pulses when it is (re)mounted for a new value — keyed by the value by its parent — but not when
 * the panel itself has just opened: `armed` is false on the panel's first render and the choice is kept for the
 * life of the element, so later re-renders never start the pulse on a figure that has not changed.
 */
function Counter({ value, label, armed, tone, testId }: { value: number; label: string; armed: boolean; tone: 'dragon' | 'panda'; testId: string }): ReactNode {
  const [pulse] = useState(armed);
  return (
    <span className={cx(styles.counter, pulse && styles.counterPulse, tone === 'dragon' ? styles.counterDragon : styles.counterPanda)} data-testid={testId} data-pulse={pulse || undefined}>
      {value} {label}
    </span>
  );
}

export interface SessionStatsPanelProps {
  stats: SessionStats;
  biggestWin: number;
  biggestLoss: number;
}

export function SessionStatsPanel({ stats, biggestWin, biggestLoss }: SessionStatsPanelProps): ReactNode {
  const rows = BET_TYPES.filter((b) => stats.byBet[b].count > 0);
  const armedRef = useRef(false);
  const armed = armedRef.current;
  useEffect(() => {
    armedRef.current = true;
  }, []);
  return (
    <>
      <div className={styles.statGrid}>
        <Stat label="Biggest win" size="sm" tone={biggestWin > 0 ? 'positive' : 'neutral'} value={biggestWin > 0 ? formatMoney(biggestWin, { signed: true }) : '—'} />
        <Stat label="Biggest loss" size="sm" tone={biggestLoss < 0 ? 'negative' : 'neutral'} value={biggestLoss < 0 ? formatMoney(biggestLoss) : '—'} />
        <Stat label="Peak bankroll" size="sm" tone="gold" value={formatMoney(stats.peakBankroll)} />
        <Stat label="Low bankroll" size="sm" value={formatMoney(stats.lowBankroll)} />
        <Stat label="Max drawdown" size="sm" tone={stats.maxDrawdown > 0 ? 'negative' : 'neutral'} value={stats.maxDrawdown > 0 ? formatMoney(-stats.maxDrawdown) : '—'} />
        <Stat label="Commission paid" size="sm" value={formatMoney(stats.commissionPaid)} />
        <Stat
          label="Naturals"
          size="sm"
          value={stats.naturals}
          sub={
            <>
              <Counter key={`d7-${stats.dragon7s}`} value={stats.dragon7s} label="D7" armed={armed} tone="dragon" testId="stat-dragon7" /> · <Counter key={`p8-${stats.panda8s}`} value={stats.panda8s} label="P8" armed={armed} tone="panda" testId="stat-panda8" />
            </>
          }
        />
        <Stat label="P / B / T" size="sm" value={`${stats.playerWins} / ${stats.bankerWins} / ${stats.ties}`} sub={`${stats.playerPairs} PP · ${stats.bankerPairs} BP`} />
      </div>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>By bet</h3>
        {rows.length === 0 ? (
          <p className={styles.muted}>No bets settled yet.</p>
        ) : (
          <table className={styles.table} data-testid="stats-by-bet">
            <thead>
              <tr>
                <th scope="col">Bet</th>
                <th scope="col">W</th>
                <th scope="col">L</th>
                <th scope="col">P</th>
                <th scope="col">Wagered</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((bet) => {
                const s = stats.byBet[bet];
                return (
                  <tr key={bet}>
                    <td>{BET_LABELS[bet]}</td>
                    <td>{s.wins}</td>
                    <td>{s.losses}</td>
                    <td>{s.pushes}</td>
                    <td>{formatMoney(s.wagered)}</td>
                    <td className={cx(toneForNet(s.net) === 'positive' && styles.tdPositive, toneForNet(s.net) === 'negative' && styles.tdNegative)}>{formatMoney(s.net, { signed: true })}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td>{formatMoney(stats.totalWagered)}</td>
                <td className={cx(toneForNet(stats.net) === 'positive' && styles.tdPositive, toneForNet(stats.net) === 'negative' && styles.tdNegative)}>{formatMoney(stats.net, { signed: true })}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
