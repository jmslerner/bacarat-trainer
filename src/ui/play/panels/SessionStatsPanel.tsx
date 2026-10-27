/**
 * SessionStatsPanel — wins/losses by bet type, biggest win and loss, peak/low bankroll, drawdown, commission.
 */
import type { ReactNode } from 'react';
import type { SessionStats } from '@/engine';
import { BET_LABELS, BET_TYPES } from '@/engine';
import { Stat, cx, formatMoney, toneForNet } from '@/ui/shell';
import styles from './Panels.module.css';

export interface SessionStatsPanelProps {
  stats: SessionStats;
  biggestWin: number;
  biggestLoss: number;
}

export function SessionStatsPanel({ stats, biggestWin, biggestLoss }: SessionStatsPanelProps): ReactNode {
  const rows = BET_TYPES.filter((b) => stats.byBet[b].count > 0);
  return (
    <>
      <div className={styles.statGrid}>
        <Stat label="Biggest win" size="sm" tone={biggestWin > 0 ? 'positive' : 'neutral'} value={biggestWin > 0 ? formatMoney(biggestWin, { signed: true }) : '—'} />
        <Stat label="Biggest loss" size="sm" tone={biggestLoss < 0 ? 'negative' : 'neutral'} value={biggestLoss < 0 ? formatMoney(biggestLoss) : '—'} />
        <Stat label="Peak bankroll" size="sm" tone="gold" value={formatMoney(stats.peakBankroll)} />
        <Stat label="Low bankroll" size="sm" value={formatMoney(stats.lowBankroll)} />
        <Stat label="Max drawdown" size="sm" tone={stats.maxDrawdown > 0 ? 'negative' : 'neutral'} value={stats.maxDrawdown > 0 ? formatMoney(-stats.maxDrawdown) : '—'} />
        <Stat label="Commission paid" size="sm" value={formatMoney(stats.commissionPaid)} />
        <Stat label="Naturals" size="sm" value={stats.naturals} sub={`${stats.dragon7s} D7 · ${stats.panda8s} P8`} />
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
