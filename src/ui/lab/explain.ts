/**
 * One line of plain English per result: what the number means for the player. Pure TypeScript.
 */
import { exactProbabilities, formatMoney } from '@/engine';
import type { TableRules } from '@/engine';
import { getSelector, getSystem } from '@/strategy';
import type { SideBetMode, SideBetSimStats, SimResult } from '@/strategy';
import { SIDE_BET_LABELS } from './config';
import { edgeVerdict, formatEdgeRange, isEdgeRange, type EdgeEstimate, type EdgeRange } from './edge';

const pct = (fraction: number, digits = 1): string => `${(fraction * 100).toFixed(digits)}%`;
const count = (n: number): string => n.toLocaleString('en-US');
const per100 = (edge: number): string => formatMoney(Math.abs(edge) * 100);

/** "one session" / "1,000 sessions" wording helpers. */
const sessions = (n: number): string => (n === 1 ? '1 session' : `${count(n)} sessions`);

export function explainMeanFinal(result: SimResult): string {
  const start = result.config.bankroll;
  const diff = result.meanFinal - start;
  if (diff >= 0.005) return `On average a session ended ${formatMoney(diff)} ahead of the ${formatMoney(start)} it started with.`;
  if (diff <= -0.005) return `On average a session ended ${formatMoney(-diff)} down on the ${formatMoney(start)} it started with.`;
  return `On average a session ended exactly where it started, at ${formatMoney(start)}.`;
}

export function explainMedianFinal(result: SimResult): string {
  if (result.medianFinal <= 0) {
    return result.meanFinal > 0.005
      ? 'At least half of the sessions ended with nothing left; the average is carried by the few that won big.'
      : 'Every session ended with nothing left.';
  }
  const base = `Half of the sessions finished below ${formatMoney(result.medianFinal)} and half above it.`;
  const gap = result.meanFinal - result.medianFinal;
  if (gap > Math.max(1, 0.02 * result.config.bankroll)) return `${base} A few big wins pull the average above the typical session.`;
  if (gap < -Math.max(1, 0.02 * result.config.bankroll)) return `${base} A few busts pull the average below the typical session.`;
  return base;
}

export function explainPProfit(result: SimResult): string {
  const n = Math.round(result.pProfit * 100);
  if (n === 0) return 'Not one session in a hundred ends with more money than it started with.';
  return `${n} in 100 sessions like this end with more money than they started with.`;
}

export function explainPRuin(result: SimResult): string {
  const stop = result.config.stopLoss !== undefined ? ' or hit the stop loss' : '';
  if (result.pRuin === 0) return `No session ran out of money${stop} before the last shoe.`;
  return `${pct(result.pRuin)} of sessions ran out of money${stop} before the last shoe.`;
}

export function explainRealizedEdge(result: SimResult): string {
  if (!(result.totalWagered > 0)) return 'Nothing was wagered, so there is no edge to measure.';
  const edge = result.realizedEdge;
  if (edge > 1e-9) return `The house kept ${per100(edge)} of every $100 wagered across all sessions.`;
  if (edge < -1e-9) return `The player kept ${per100(edge)} of every $100 wagered: the edge was on your side this run.`;
  return 'The house and the player broke exactly even on the money wagered.';
}

export function explainExpectedEdge(result: SimResult, expected: EdgeEstimate | null): string {
  if (!expected) return 'Nothing was wagered, so the math has nothing to price.';
  const verdict = edgeVerdict(result.realizedEdge, expected);
  const playerEdge = expected.high < 0;
  const source = expected.simulated ? 'The simulated count table' : 'The math';
  if (playerEdge) {
    // "Agrees" only when the player actually came out ahead per dollar wagered, not merely within the noise band.
    return verdict === 'inLine' && result.realizedEdge < 0
      ? `${source} says the player holds the edge here, and this run agrees: counting the side bet pays.`
      : `${source} says the player holds the edge here; the run strayed from it, as short runs do.`;
  }
  if (expected.simulated && verdict === 'inLine') return 'The run landed where the exact main-bet edge and the simulated count table put it.';
  if (verdict === 'luckier') return 'Luckier than the math this time; more trials pull the realized edge back toward this figure.';
  if (verdict === 'unluckier') return 'Unluckier than the math this time; more trials pull the realized edge back toward this figure.';
  return isEdgeRange(expected)
    ? 'The realized edge sits inside the exact range for these bets: no system changes what the house keeps.'
    : 'The realized edge landed on the exact figure: no system changes what the house keeps.';
}

export function explainMeanDrawdown(result: SimResult): string {
  if (result.meanMaxDrawdown < 0.005) return 'No session ever dipped below its best point.';
  return `A typical session dipped ${formatMoney(result.meanMaxDrawdown)} below its best point along the way.`;
}

export function explainWorstDrawdown(result: SimResult): string {
  if (result.worstDrawdown < 0.005) return 'Not one session gave anything back from its peak.';
  return `The unluckiest session fell ${formatMoney(result.worstDrawdown)} from its peak.`;
}

export function explainHands(result: SimResult): string {
  if (result.handsPlayed === 0) return 'No hands were dealt.';
  const share = result.handsBet / result.handsPlayed;
  return share >= 0.999
    ? `Hands dealt across all sessions, with a bet down on every one of them.`
    : `Hands dealt across all sessions; a bet was down on ${pct(share, 0)} of them (${count(result.handsBet)}).`;
}

export function explainWagered(result: SimResult): string {
  if (!(result.totalWagered > 0)) return 'No money was put on the table.';
  const net = result.net;
  if (net >= 0.005) return `Everything put on the table across all sessions; the players came out ${formatMoney(net)} ahead in total.`;
  if (net <= -0.005) return `Everything put on the table across all sessions; the house collected ${formatMoney(-net)} of it in total.`;
  return 'Everything put on the table across all sessions; it all came back.';
}

export function explainSpread(result: SimResult): string {
  return `Typical distance of a session's finish from the average (${formatMoney(result.meanFinal)}): the bigger it is, the swingier the ride.`;
}

export function explainPercentiles(result: SimResult): string {
  const { p5, p95 } = result.percentiles;
  return `Nine sessions in ten finished between ${formatMoney(p5)} and ${formatMoney(p95)}.`;
}

export function explainOutcomeMix(result: SimResult, rules: TableRules): string {
  const total = result.byOutcome.player + result.byOutcome.banker + result.byOutcome.tie;
  if (total === 0) return 'No hands were dealt.';
  const exact = exactProbabilities(rules.decks);
  const b = pct(result.byOutcome.banker / total);
  const p = pct(result.byOutcome.player / total);
  const t = pct(result.byOutcome.tie / total);
  return `Banker won ${b} of hands (math ${pct(exact.banker)}), Player ${p} (${pct(exact.player)}), Tie ${t} (${pct(exact.tie)}): the cards do not care about the strategy.`;
}

export function explainSideBet(bet: 'dragon7' | 'panda8', stats: SideBetSimStats, mode: SideBetMode, rules: TableRules): string {
  const label = SIDE_BET_LABELS[bet];
  if (stats.bets === 0) return mode === 'never' ? `No ${label} bets were placed.` : `The ${label} was never bet (not dealt on this table, or the bankroll could not cover it).`;
  const exact = exactProbabilities(rules.decks);
  const base = bet === 'dragon7' ? exact.dragon7 : exact.panda8;
  const hitRate = stats.wins / stats.bets;
  const ret = stats.wagered > 0 ? stats.net / stats.wagered : 0;
  const money = ret < 0 ? `cost ${per100(ret)} per $100 wagered` : ret > 0 ? `made ${per100(ret)} per $100 wagered` : 'broke even';
  if (mode === 'count') {
    const edge = hitRate > base ? ': that is the counting edge at work' : ': the count did not find its edge in this run';
    return `Betting only when the count said so, the ${label} hit ${pct(hitRate, 2)} of the time against ${pct(base, 2)} on a random hand${edge}; it ${money}.`;
  }
  return `Betting every hand, the ${label} hit ${pct(hitRate, 2)} of the time (math ${pct(base, 2)}) and ${money}.`;
}

/** The two-sentence verdict shown above the result cards. */
export function verdictSentence(result: SimResult, expected: EdgeEstimate | null): string {
  const { config } = result;
  const selector = getSelector(config.strategy.selectorId)?.name ?? config.strategy.selectorId;
  const system = getSystem(config.strategy.systemId)?.name ?? config.strategy.systemId;
  const diff = result.meanFinal - config.bankroll;
  const outcome = diff >= 0.005 ? `came out ${formatMoney(diff)} ahead on average` : diff <= -0.005 ? `lost ${formatMoney(-diff)} on average` : 'broke even on average';
  const shoes = config.shoesPerTrial === 1 ? 'one shoe' : `${count(config.shoesPerTrial)} shoes`;
  const first = `Over ${sessions(config.trials)} of ${shoes}, ${selector} with ${system} ${outcome}.`;
  let second: string;
  if (!(result.totalWagered > 0) || !expected) {
    second = 'Nothing was wagered, so there is no edge to measure.';
  } else {
    const kept = result.realizedEdge >= 0 ? `The house kept ${pct(result.realizedEdge, 2)} of every dollar wagered` : `The player kept ${pct(-result.realizedEdge, 2)} of every dollar wagered`;
    const source = expected.simulated ? 'the count table' : 'the math';
    const math = expected.high < 0 ? `${source} gives the player ${formatEdgeRange({ low: -expected.high, high: -expected.low })}` : `${source} says ${formatEdgeRange(expected)}`;
    const ruin = config.stopLoss !== undefined ? 'hit the stop loss or went bust' : 'went bust';
    second = `${kept} (${math}); ${pct(result.pProfit, 0)} of sessions ended ahead and ${pct(result.pRuin, 0)} ${ruin}.`;
  }
  return `${first} ${second}`;
}

export type { EdgeRange };
