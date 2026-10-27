/**
 * Everything shown for a finished run: the verdict, the summary stat cards (each with one line of plain English),
 * the histogram and the sample curves, side-bet statistics and the outcome mix.
 */
import type { ReactNode } from 'react';
import { exactProbabilities } from '@/engine';
import type { TableRules } from '@/engine';
import { describeStrategy } from '@/strategy';
import type { SideBetMode, SideBetSimStats, SimResult } from '@/strategy';
import { Button, Stat, cx, formatMoney, formatNumber, formatPercent, ruleSummary, toneForNet } from '@/ui/shell';
import type { StatTone } from '@/ui/shell';
import { Histogram } from '../charts/Histogram';
import { CurvesChart } from '../charts/CurvesChart';
import { SIDE_BET_LABELS } from '../config';
import { expectedEdge, formatEdgeRange } from '../edge';
import {
  explainExpectedEdge,
  explainHands,
  explainMeanDrawdown,
  explainMeanFinal,
  explainMedianFinal,
  explainOutcomeMix,
  explainPProfit,
  explainPRuin,
  explainPercentiles,
  explainRealizedEdge,
  explainSideBet,
  explainSpread,
  explainWagered,
  explainWorstDrawdown,
  verdictSentence,
} from '../explain';
import styles from '../Lab.module.css';

export interface ResultsPanelProps {
  result: SimResult;
  /** A new run is in progress: keep the frame, dim it. */
  stale?: boolean;
  saved: boolean;
  savedCount: number;
  maxSaved: number;
  onSave(): void;
}

interface StatSpec {
  key: string;
  label: string;
  value: string;
  tone: StatTone;
  explain: string;
}

const MODE_LABEL: Record<SideBetMode, string> = { never: 'never', always: 'every hand', count: 'when the count says so' };

function sideRow(bet: 'dragon7' | 'panda8', stats: SideBetSimStats, mode: SideBetMode, rules: TableRules): ReactNode {
  const exact = exactProbabilities(rules.decks);
  const base = bet === 'dragon7' ? exact.dragon7 : exact.panda8;
  const hitRate = stats.bets > 0 ? stats.wins / stats.bets : null;
  const ret = stats.wagered > 0 ? stats.net / stats.wagered : null;
  return (
    <tr key={bet} data-testid={`lab-side-${bet}`}>
      <td>{SIDE_BET_LABELS[bet]}</td>
      <td>{rules.sideBets[bet] ? MODE_LABEL[mode] : 'not dealt'}</td>
      <td>{formatNumber(stats.bets)}</td>
      <td>{formatNumber(stats.wins)}</td>
      <td>{hitRate === null ? '—' : `${formatPercent(hitRate, 2)} (math ${formatPercent(base, 2)})`}</td>
      <td>{formatMoney(stats.wagered)}</td>
      <td className={stats.net > 0 ? 'c-win' : stats.net < 0 ? 'c-loss' : undefined}>{formatMoney(stats.net, { signed: true })}</td>
      <td className={ret !== null && ret > 0 ? 'c-win' : ret !== null && ret < 0 ? 'c-loss' : undefined}>{ret === null ? '—' : formatPercent(ret, 2, true)}</td>
    </tr>
  );
}

export function ResultsPanel({ result, stale, saved, savedCount, maxSaved, onSave }: ResultsPanelProps): ReactNode {
  const { config } = result;
  const start = config.bankroll;
  const expected = expectedEdge(result);
  const wagered = result.totalWagered > 0;
  const policy = config.strategy.sideBets;
  const anySide = result.sideBets.dragon7.bets > 0 || result.sideBets.panda8.bets > 0;
  const total = result.byOutcome.player + result.byOutcome.banker + result.byOutcome.tie;
  const exact = exactProbabilities(config.rules.decks);

  const stats: StatSpec[] = [
    { key: 'mean', label: 'Mean final bankroll', value: formatMoney(result.meanFinal), tone: toneForNet(result.meanFinal - start), explain: explainMeanFinal(result) },
    { key: 'median', label: 'Median final bankroll', value: formatMoney(result.medianFinal), tone: toneForNet(result.medianFinal - start), explain: explainMedianFinal(result) },
    { key: 'pProfit', label: 'Chance of a winning session', value: formatPercent(result.pProfit, 1), tone: result.pProfit >= 0.5 ? 'positive' : 'neutral', explain: explainPProfit(result) },
    { key: 'pRuin', label: 'Risk of ruin', value: formatPercent(result.pRuin, 1), tone: result.pRuin === 0 ? 'positive' : result.pRuin > 0.1 ? 'negative' : 'neutral', explain: explainPRuin(result) },
    {
      key: 'realized',
      label: 'Realized house edge',
      value: wagered ? formatPercent(result.realizedEdge, 2) : '—',
      tone: !wagered ? 'neutral' : result.realizedEdge > 0 ? 'negative' : result.realizedEdge < 0 ? 'positive' : 'neutral',
      explain: explainRealizedEdge(result),
    },
    { key: 'exact', label: `Exact edge (${expected ? expected.main.label : 'math'})`, value: expected ? formatEdgeRange(expected) : '—', tone: 'gold', explain: explainExpectedEdge(result, expected) },
    { key: 'drawdown', label: 'Mean max drawdown', value: formatMoney(result.meanMaxDrawdown), tone: result.meanMaxDrawdown > 0 ? 'negative' : 'neutral', explain: explainMeanDrawdown(result) },
    { key: 'worst', label: 'Worst drawdown', value: formatMoney(result.worstDrawdown), tone: result.worstDrawdown > 0 ? 'negative' : 'neutral', explain: explainWorstDrawdown(result) },
    { key: 'hands', label: 'Hands dealt', value: formatNumber(result.handsPlayed), tone: 'neutral', explain: explainHands(result) },
    { key: 'wagered', label: 'Total wagered', value: formatMoney(result.totalWagered), tone: 'neutral', explain: explainWagered(result) },
    { key: 'spread', label: 'Spread of finishes (std dev)', value: formatMoney(result.stdFinal), tone: 'neutral', explain: explainSpread(result) },
    { key: 'range', label: '90% of sessions finished between', value: `${formatMoney(result.percentiles.p5)} – ${formatMoney(result.percentiles.p95)}`, tone: 'neutral', explain: explainPercentiles(result) },
  ];

  const mix = [
    { key: 'banker', letter: 'B', label: 'Banker', count: result.byOutcome.banker, exact: exact.banker, cls: styles.mixBanker },
    { key: 'player', letter: 'P', label: 'Player', count: result.byOutcome.player, exact: exact.player, cls: styles.mixPlayer },
    { key: 'tie', letter: 'T', label: 'Tie', count: result.byOutcome.tie, exact: exact.tie, cls: styles.mixTie },
  ];

  return (
    <section className={cx(styles.results, stale && styles.stale)} aria-label="Simulation results" aria-busy={stale || undefined} data-testid="lab-results">
      <div className={cx(styles.card)}>
        <div className={styles.resultsHead}>
          <div>
            <h2 className={styles.cardTitle}>Results</h2>
            <p className={styles.strategyLine} data-testid="lab-strategy">
              {describeStrategy(config.strategy)}
            </p>
            <ul className={styles.meta} aria-label="Run details">
              <li>{ruleSummary(config.rules)}</li>
              <li>
                {formatNumber(config.trials)} trials × {formatNumber(config.shoesPerTrial)} {config.shoesPerTrial === 1 ? 'shoe' : 'shoes'}
              </li>
              <li>Bankroll {formatMoney(config.bankroll)}</li>
              {config.stopLoss !== undefined && <li>Stop loss {formatMoney(config.stopLoss)}</li>}
              {config.stopWin !== undefined && <li>Stop win {formatMoney(config.stopWin)}</li>}
              <li>Seed {config.seed}</li>
              <li>Simulated in {(result.elapsedMs / 1000).toFixed(result.elapsedMs < 10_000 ? 1 : 0)} s</li>
            </ul>
          </div>
          <div className={styles.headActions}>
            <Button variant="primary" onClick={onSave} disabled={saved} data-testid="lab-save" title={savedCount >= maxSaved && !saved ? `Replaces the oldest of the ${maxSaved} saved runs` : undefined}>
              {saved ? 'Saved' : savedCount >= maxSaved ? 'Save run (replaces oldest)' : 'Save run'}
            </Button>
          </div>
        </div>
        <p className={styles.verdict} data-testid="lab-verdict">
          {verdictSentence(result, expected)}
        </p>
      </div>

      <div className={styles.stats} data-testid="lab-stats">
        {stats.map((s) => (
          <Stat key={s.key} label={s.label} value={s.value} tone={s.tone} sub={s.explain} className={undefined} title={s.label} />
        ))}
      </div>

      <div className={styles.charts}>
        <div className={styles.card}>
          <Histogram bins={result.histogram} start={start} trials={result.trials} />
        </div>
        <div className={styles.card}>
          <CurvesChart curves={result.sampleCurves} curveHands={result.curveHands} start={start} />
        </div>
      </div>

      <div className={styles.panels}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Side bets</h3>
            <p className={styles.cardSub}>Dragon 7 and Panda 8 under this policy</p>
          </div>
          {anySide || policy.dragon7 !== 'never' || policy.panda8 !== 'never' ? (
            <div className={styles.tableWrap}>
              <table className={styles.table} data-testid="lab-side-bets">
                <thead>
                  <tr>
                    <th scope="col">Bet</th>
                    <th scope="col">Policy</th>
                    <th scope="col">Bets</th>
                    <th scope="col">Hits</th>
                    <th scope="col">Hit rate</th>
                    <th scope="col">Wagered</th>
                    <th scope="col">Net</th>
                    <th scope="col">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {sideRow('dragon7', result.sideBets.dragon7, policy.dragon7, config.rules)}
                  {sideRow('panda8', result.sideBets.panda8, policy.panda8, config.rules)}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.explain}>No side bets in this strategy. Try the "Count Dragon 7" preset to see where the only real edge comes from.</p>
          )}
          <ul className={styles.explainList}>
            <li className={styles.explain}>{explainSideBet('dragon7', result.sideBets.dragon7, policy.dragon7, config.rules)}</li>
            <li className={styles.explain}>{explainSideBet('panda8', result.sideBets.panda8, policy.panda8, config.rules)}</li>
          </ul>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>How the hands fell</h3>
            <p className={styles.cardSub}>{formatNumber(total)} hands</p>
          </div>
          <ul className={styles.mix} data-testid="lab-outcomes">
            {mix.map((m) => {
              const share = total > 0 ? m.count / total : 0;
              return (
                <li key={m.key} className={styles.mixRow}>
                  <span className={cx(styles.mixLetter, m.cls)} aria-hidden="true">
                    {m.letter}
                  </span>
                  <span className={styles.mixTrack} aria-hidden="true">
                    <span className={cx(styles.mixFill, m.cls)} style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </span>
                  <span className={styles.mixValue}>
                    <span className="sr-only">{m.label} </span>
                    {formatPercent(share, 2)}
                    <small>math {formatPercent(m.exact, 2)}</small>
                  </span>
                </li>
              );
            })}
          </ul>
          <ul className={styles.explainList}>
            <li className={styles.explain}>{explainOutcomeMix(result, config.rules)}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
