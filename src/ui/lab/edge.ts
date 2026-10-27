/**
 * What the math says a run should lose: the exact house edge of the bets in the mix, blended by how much was
 * actually wagered on each (SPEC §5.7 "realized edge vs. exact edge"). Pure TypeScript.
 */
import { DEFAULT_RULES, houseEdge } from '@/engine';
import type { TableRules } from '@/engine';
import { COUNT_EV_META } from '@/strategy';
import type { SideBetMode, SimResult } from '@/strategy';

export interface EdgeRange {
  /** House edge as a positive fraction of the amount wagered (negative = the player has the edge). */
  low: number;
  high: number;
}

export interface MainEdge extends EdgeRange {
  /** "Banker", "Player" or "Banker / Player" for selectors that switch sides. */
  label: string;
}

export interface EdgeEstimate extends EdgeRange {
  main: MainEdge;
  /** House edge per dollar of each side bet in the mix (null when the policy never bets it). */
  dragon7: number | null;
  panda8: number | null;
  /** True when a count-based policy contributed a figure from the simulated count table rather than exact math. */
  simulated: boolean;
}

export function isEdgeRange(r: EdgeRange): boolean {
  return Math.abs(r.high - r.low) > 1e-12;
}

/** The exact house edge of the main bet a selector places (a range for selectors that bet both sides). */
export function mainEdgeRange(selectorId: string, rules: TableRules): MainEdge {
  const banker = houseEdge('banker', rules);
  const player = houseEdge('player', rules);
  if (selectorId === 'alwaysBanker') return { low: banker, high: banker, label: 'Banker' };
  if (selectorId === 'alwaysPlayer') return { low: player, high: player, label: 'Player' };
  return { low: Math.min(banker, player), high: Math.max(banker, player), label: 'Banker / Player' };
}

/**
 * House edge per dollar of a side bet under a policy: exact for "always"; for "count" the simulated EV of the bet
 * at or above its count threshold (COUNT_EV_META), re-priced for the table's payout when it differs from 40:1 / 25:1.
 */
export function sideBetHouseEdge(bet: 'dragon7' | 'panda8', mode: SideBetMode, rules: TableRules): number | null {
  if (mode === 'never' || !rules.sideBets[bet]) return null;
  if (mode === 'always') return houseEdge(bet, rules);
  const pays = bet === 'dragon7' ? rules.dragon7Pays : rules.panda8Pays;
  const defaultPays = bet === 'dragon7' ? DEFAULT_RULES.dragon7Pays : DEFAULT_RULES.panda8Pays;
  const ev = COUNT_EV_META.atThreshold[bet].ev;
  // ev = p × (pays + 1) − 1 at the default payout, so the hit rate on qualifying hands is (ev + 1) / (pays + 1).
  const hitRate = (ev + 1) / (defaultPays + 1);
  return -(hitRate * (pays + 1) - 1);
}

/** The exact edge of a finished run's bet mix, weighted by what was wagered on each bet; null when nothing was wagered. */
export function expectedEdge(result: SimResult): EdgeEstimate | null {
  const { rules, strategy } = result.config;
  const total = result.totalWagered;
  if (!(total > 0)) return null;
  const main = mainEdgeRange(strategy.selectorId, rules);
  const d7Wagered = result.sideBets.dragon7.wagered;
  const p8Wagered = result.sideBets.panda8.wagered;
  const mainWagered = Math.max(0, total - d7Wagered - p8Wagered);
  const dragon7 = d7Wagered > 0 ? sideBetHouseEdge('dragon7', strategy.sideBets.dragon7, rules) : null;
  const panda8 = p8Wagered > 0 ? sideBetHouseEdge('panda8', strategy.sideBets.panda8, rules) : null;
  const sideTotal = (dragon7 ?? 0) * d7Wagered + (panda8 ?? 0) * p8Wagered;
  const low = (main.low * mainWagered + sideTotal) / total;
  const high = (main.high * mainWagered + sideTotal) / total;
  const simulated = (dragon7 !== null && strategy.sideBets.dragon7 === 'count') || (panda8 !== null && strategy.sideBets.panda8 === 'count');
  return { low, high, main, dragon7, panda8, simulated };
}

/** "1.02%" or "1.02–1.24%" (negative figures keep their sign, e.g. "-0.35%"; a range across zero reads "-0.35% to 1.02%"). */
export function formatEdgeRange(range: EdgeRange, digits = 2): string {
  const num = (f: number): string => (f * 100).toFixed(digits);
  if (!isEdgeRange(range)) return `${num(range.low)}%`;
  return range.low < 0 && range.high > 0 ? `${num(range.low)}% to ${num(range.high)}%` : `${num(range.low)}–${num(range.high)}%`;
}

export type EdgeVerdict = 'inLine' | 'luckier' | 'unluckier';

/** How the realized edge of a run compares with the exact figure, allowing for Monte Carlo noise. */
export function edgeVerdict(realized: number, expected: EdgeRange): EdgeVerdict {
  const tolerance = Math.max(0.003, 0.25 * Math.max(Math.abs(expected.low), Math.abs(expected.high)));
  if (realized < expected.low - tolerance) return 'luckier';
  if (realized > expected.high + tolerance) return 'unluckier';
  return 'inLine';
}
