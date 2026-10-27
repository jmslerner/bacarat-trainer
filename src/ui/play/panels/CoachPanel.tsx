/**
 * CoachPanel — the math behind the table: house edge and expected loss of every bet on the layout, the Dragon 7
 * and Panda 8 counts with a recommendation, the current streak, the session's realized edge, and the beginner
 * tips toggle with the explanation of the last dealer call.
 */
import type { ReactNode } from 'react';
import type { BetType, Bets, Card, SessionStats, ShoeInfo, StreakInfo, TableRules } from '@/engine';
import { BET_LABELS, BET_TYPES, expectedValue, houseEdge, isBetEnabled } from '@/engine';
import { Stat, Toggle, cx, formatMoney, formatNumber, formatPercent, formatSigned, toneForNet } from '@/ui/shell';
import { countStates, decksRemaining, DRAGON7_COUNT, PANDA8_COUNT, type CountState, type CountSystem } from '../coach/counts';
import styles from './Panels.module.css';

export interface CoachPanelProps {
  rules: TableRules;
  /** The bets being evaluated: the live layout, or the layout in play while a hand is dealt. */
  bets: Bets;
  seenCards: readonly Card[];
  shoe: ShoeInfo;
  stats: SessionStats;
  streak: StreakInfo;
  beginnerTips: boolean;
  onToggleTips: (on: boolean) => void;
  /** Explanation of the dealer's current call (null when none). */
  lastCall: { message: string; tip: string | null } | null;
}

const STREAK_NAME: Record<'player' | 'banker' | 'tie', string> = { player: 'Player', banker: 'Banker', tie: 'Tie' };

function CountRow({ system, state, shoe, enabled, label }: { system: CountSystem; state: CountState; shoe: ShoeInfo; enabled: boolean; label: string }): ReactNode {
  const hot = state.trueCount >= system.threshold;
  const decks = decksRemaining(shoe.cardsRemaining);
  const advice = !enabled
    ? `${label} is not offered at this table — the count is shown for study.`
    : hot
      ? `True count ${formatSigned(state.trueCount, 1)} ≥ ${system.threshold} — ${label} is +EV now`
      : `True count ${formatSigned(state.trueCount, 1)} < ${system.threshold} — skip the ${label}`;
  // Meter: the true count on a ±12 scale around zero, with the threshold marked.
  const scale = 12;
  const clamp = Math.max(-scale, Math.min(scale, state.trueCount));
  const left = clamp < 0 ? 50 + (clamp / scale) * 50 : 50;
  const width = (Math.abs(clamp) / scale) * 50;
  const thresholdLeft = 50 + (Math.min(scale, system.threshold) / scale) * 50;
  return (
    <div className={cx(styles.count, hot && enabled && styles.countHot)} data-testid={`count-${system.id}`} data-true-count={state.trueCount.toFixed(2)} data-hot={hot}>
      <span className={styles.countName}>{label} count</span>
      <span className={styles.countNumbers}>
        <span className={styles.countTrue} aria-label={`True count ${formatSigned(state.trueCount, 1)}`}>
          {formatSigned(state.trueCount, 1)}
        </span>
        <span className={styles.countRunning}>
          running {formatSigned(state.running)} · {formatNumber(decks, 1)} decks left
        </span>
      </span>
      <span className={styles.countAdvice}>{advice}</span>
      <span className={styles.meter} aria-hidden="true">
        <span className={styles.meterZero} />
        <span className={styles.meterFill} style={{ left: `${left}%`, width: `${width}%` }} />
        <span className={styles.meterThreshold} style={{ left: `${thresholdLeft}%` }} />
      </span>
      <span className={styles.tags}>{system.description}</span>
    </div>
  );
}

export function CoachPanel({ rules, bets, seenCards, shoe, stats, streak, beginnerTips, onToggleTips, lastCall }: CoachPanelProps): ReactNode {
  const active = BET_TYPES.filter((b) => (bets[b] ?? 0) > 0);
  const totalExpected = active.reduce((s, b) => s + expectedValue(b, bets[b] ?? 0, rules), 0);
  const offered = BET_TYPES.filter((b) => isBetEnabled(b, rules));
  const ranked = [...offered].sort((a, b) => houseEdge(a, rules) - houseEdge(b, rules));
  const best = ranked[0];
  const counts = countStates(seenCards, shoe.cardsRemaining);
  const realized = stats.totalWagered > 0 ? -stats.net / stats.totalWagered : 0;
  const edgeCell = (bet: BetType): string => formatPercent(houseEdge(bet, rules), 2);

  return (
    <>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{active.length > 0 ? 'Your bets' : 'House edge by bet'}</h3>
        {active.length > 0 ? (
          <table className={styles.table} data-testid="coach-bets">
            <thead>
              <tr>
                <th scope="col">Bet</th>
                <th scope="col">Amount</th>
                <th scope="col">Edge</th>
                <th scope="col">Exp. loss</th>
              </tr>
            </thead>
            <tbody>
              {active.map((bet) => {
                const amount = bets[bet] ?? 0;
                const ev = expectedValue(bet, amount, rules);
                return (
                  <tr key={bet}>
                    <td>{BET_LABELS[bet]}</td>
                    <td>{formatMoney(amount)}</td>
                    <td>{edgeCell(bet)}</td>
                    <td className={styles.tdNegative}>{formatMoney(ev, { signed: true, cents: true })}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Expected loss this hand</td>
                <td className={styles.tdNegative}>{formatMoney(totalExpected, { signed: true, cents: true })}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className={styles.table} data-testid="coach-edges">
            <thead>
              <tr>
                <th scope="col">Bet</th>
                <th scope="col">Pays</th>
                <th scope="col">House edge</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((bet) => (
                <tr key={bet} className={bet === best ? styles.rowBest : undefined}>
                  <td>
                    {BET_LABELS[bet]}
                    {bet === best ? ' ★' : ''}
                  </td>
                  <td>{payoutText(bet, rules)}</td>
                  <td>{edgeCell(bet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles.muted}>{active.length > 0 ? 'Expected loss = amount × house edge. Over many hands the average result converges to it.' : `Lowest edge: ${BET_LABELS[best]} at ${edgeCell(best)}. Place chips to see the cost of your layout.`}</p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Card counts</h3>
        <CountRow system={DRAGON7_COUNT} state={counts.dragon7} shoe={shoe} enabled={rules.sideBets.dragon7} label="Dragon 7" />
        <CountRow system={PANDA8_COUNT} state={counts.panda8} shoe={shoe} enabled={rules.sideBets.panda8} label="Panda 8" />
        <p className={styles.muted}>
          Counted from every face-up card of this shoe ({seenCards.length} seen, exposed burn card included). True count = running count ÷ decks remaining.
        </p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Streak &amp; session</h3>
        <div className={cx(styles.statGrid, styles.statGrid3)}>
          <Stat
            label="Streak"
            size="sm"
            tone={streak.outcome === 'banker' ? 'banker' : streak.outcome === 'player' ? 'player' : streak.outcome === 'tie' ? 'tie' : 'neutral'}
            value={streak.outcome === null ? '—' : `${STREAK_NAME[streak.outcome]} × ${streak.length}`}
          />
          <Stat label="Hands" size="sm" value={stats.handsPlayed} sub={`${stats.handsBet} with a bet`} />
          <Stat label="Net" size="sm" tone={toneForNet(stats.net)} value={formatMoney(stats.net, { signed: true })} />
          <Stat label="Wagered" size="sm" value={formatMoney(stats.totalWagered)} />
          <Stat label="Realized edge" size="sm" tone={stats.totalWagered === 0 ? 'neutral' : realized > 0 ? 'negative' : 'positive'} value={stats.totalWagered === 0 ? '—' : formatPercent(realized, 2)} sub={stats.totalWagered === 0 ? 'no bets yet' : realized > 0 ? 'house is ahead' : 'you are ahead'} />
          <Stat label="Shoes" size="sm" value={stats.shoesPlayed} />
        </div>
        <p className={styles.muted}>Streaks are what the roads show — they describe the past and do not change the next hand’s odds.</p>
      </div>

      <div className={styles.section}>
        <Toggle checked={beginnerTips} onChange={onToggleTips} label="Beginner tips" description="Explain every dealer call under the dealer bar" size="sm" />
        {beginnerTips && lastCall && lastCall.tip && (
          <div className={styles.tipBox} data-testid="coach-tip">
            <strong>{lastCall.message}</strong>
            {lastCall.tip}
          </div>
        )}
      </div>
    </>
  );
}

function payoutText(bet: BetType, rules: TableRules): string {
  switch (bet) {
    case 'player':
      return '1:1';
    case 'banker':
      return rules.bankerRule === 'ez' ? '1:1 (D7 push)' : rules.bankerRule === 'commission' ? `1:1 − ${Math.round(rules.commissionRate * 100)}%` : '1:1 (6 pays ½)';
    case 'tie':
      return `${rules.tiePays}:1`;
    case 'dragon7':
      return `${rules.dragon7Pays}:1`;
    case 'panda8':
      return `${rules.panda8Pays}:1`;
    default:
      return `${rules.pairPays}:1`;
  }
}
