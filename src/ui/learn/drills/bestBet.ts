/**
 * Best-bet drill logic (pure). Lists three or four bets offered by the active table and asks which has the
 * lowest (occasionally: highest) house edge. `houseEdge` from the engine is the oracle.
 */
import { BET_LABELS, BET_TYPES, DEFAULT_RULES, houseEdge, isBetEnabled, formatMoney } from '@/engine';
import type { BetType, Rng, TableRules } from '@/engine';
import { shuffled, weightedIndex } from './seeds';

export type BestBetMode = 'lowest' | 'highest';

export interface BestBetOption {
  bet: BetType;
  label: string;
  /** How the bet pays on this table, e.g. "1:1, no commission (push on Dragon 7)". */
  pays: string;
  /** House edge as a positive fraction. */
  edge: number;
}

export interface BestBetQuestion {
  mode: BestBetMode;
  options: BestBetOption[];
  answer: BetType;
}

const PICK_WEIGHTS: Readonly<Record<BetType, number>> = { player: 3, banker: 3, tie: 2.5, dragon7: 2, panda8: 2, playerPair: 1.5, bankerPair: 1.5 };

function ratio(n: number): string {
  return Number.isInteger(n) ? `${n}:1` : `${n.toFixed(2)}:1`;
}

/** The payout wording for a bet under the given rules. */
export function betPaysLabel(bet: BetType, rules: TableRules): string {
  switch (bet) {
    case 'player':
      return '1:1';
    case 'banker':
      if (rules.bankerRule === 'commission') return `1:1 minus ${Math.round(rules.commissionRate * 10000) / 100}% commission`;
      if (rules.bankerRule === 'super6') return '1:1, a winning 6 pays 1:2';
      return '1:1, no commission (push on Dragon 7)';
    case 'tie':
      return ratio(rules.tiePays);
    case 'dragon7':
      return ratio(rules.dragon7Pays);
    case 'panda8':
      return ratio(rules.panda8Pays);
    case 'playerPair':
    case 'bankerPair':
      return ratio(rules.pairPays);
  }
}

export function makeOption(bet: BetType, rules: TableRules): BestBetOption {
  return { bet, label: BET_LABELS[bet], pays: betPaysLabel(bet, rules), edge: houseEdge(bet, rules) };
}

function extreme(options: readonly BestBetOption[], mode: BestBetMode): BestBetOption {
  return options.reduce((best, o) => (mode === 'lowest' ? (o.edge < best.edge ? o : best) : o.edge > best.edge ? o : best));
}

function isUnique(options: readonly BestBetOption[], target: BestBetOption): boolean {
  return options.filter((o) => Math.abs(o.edge - target.edge) < 1e-9).length === 1;
}

export function generateBestBetQuestion(rng: Rng, rules: TableRules = DEFAULT_RULES): BestBetQuestion {
  const enabled = BET_TYPES.filter((b) => isBetEnabled(b, rules));
  const mode: BestBetMode = rng.next() < 0.75 ? 'lowest' : 'highest';
  const wanted = enabled.length >= 4 && rng.next() < 0.5 ? 4 : Math.min(3, enabled.length);

  for (let attempt = 0; attempt < 60; attempt++) {
    const pool = enabled.slice();
    const chosen: BetType[] = [];
    while (chosen.length < wanted && pool.length > 0) {
      const idx = weightedIndex(pool.map((b) => PICK_WEIGHTS[b]), () => rng.next());
      const bet = pool[idx];
      pool.splice(idx, 1);
      // The two pair bets share one edge: never list both (the answer must be unique).
      if (bet === 'playerPair' && chosen.includes('bankerPair')) continue;
      if (bet === 'bankerPair' && chosen.includes('playerPair')) continue;
      chosen.push(bet);
    }
    if (chosen.length < 2) break;
    const options = shuffled(chosen.map((b) => makeOption(b, rules)), (n) => rng.nextInt(n));
    const target = extreme(options, mode);
    if (isUnique(options, target)) return { mode, options, answer: target.bet };
  }

  // Player, Banker and Tie are always offered and never share an edge under playable rules.
  const options = shuffled(['player', 'banker', 'tie'].map((b) => makeOption(b as BetType, rules)), (n) => rng.nextInt(n));
  return { mode, options, answer: extreme(options, mode).bet };
}

export function formatEdge(edge: number): string {
  return `${(edge * 100).toFixed(2)}%`;
}

/** Expected loss on a $100 bet. */
export function lossPer100(edge: number): string {
  return formatMoney(Math.round(edge * 100 * 100) / 100);
}

export interface BestBetExplanation {
  /** Options from cheapest to most expensive. */
  ranked: BestBetOption[];
  lines: string[];
}

export function explainBestBet(q: BestBetQuestion, rules: TableRules): BestBetExplanation {
  const ranked = q.options.slice().sort((a, b) => a.edge - b.edge);
  const cheapest = ranked[0];
  const dearest = ranked[ranked.length - 1];
  const lines: string[] = [];
  lines.push(`${cheapest.label} is the cheapest bet listed: ${formatEdge(cheapest.edge)} house edge — about ${lossPer100(cheapest.edge)} lost per $100 wagered, on average.`);
  if (dearest !== cheapest) {
    const times = dearest.edge / cheapest.edge;
    lines.push(`${dearest.label} is the most expensive at ${formatEdge(dearest.edge)} — ${times >= 1.95 ? `${Math.round(times)}×` : `${times.toFixed(1)}×`} the cost of ${cheapest.label}.`);
  }
  const has = (b: BetType): boolean => q.options.some((o) => o.bet === b);
  if (has('banker')) {
    if (rules.bankerRule === 'ez') lines.push(`EZ Banker pays even money with no commission; the Dragon 7 push is what keeps its edge at ${formatEdge(houseEdge('banker', rules))} — the best main bet on the table.`);
    else if (rules.bankerRule === 'commission') lines.push(`Classic Banker gives up ${Math.round(rules.commissionRate * 100)}% of every win as commission, yet at ${formatEdge(houseEdge('banker', rules))} it still beats Player (${formatEdge(houseEdge('player', rules))}) because Banker wins more often.`);
    else lines.push(`Super 6 Banker pays half on a winning 6; that costs more than a 5% commission would, so its edge is ${formatEdge(houseEdge('banker', rules))}.`);
  }
  if (has('player') && !has('banker')) lines.push(`Player loses slightly more often than Banker wins, so even with no commission its edge (${formatEdge(houseEdge('player', rules))}) is a little higher than Banker's.`);
  if (has('tie')) lines.push(`Tie at ${ratio(rules.tiePays)} is the worst of the main bets: a tie comes once every 10.5 hands but pays as if it were rarer.`);
  if (has('dragon7') || has('panda8') || has('playerPair') || has('bankerPair')) {
    lines.push('Side bets are the most expensive bets on the layout: 7–11% per bet. They are fun, but they are never a better deal than Banker.');
  }
  return { ranked, lines };
}
