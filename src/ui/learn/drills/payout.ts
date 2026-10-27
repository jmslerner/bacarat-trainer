/**
 * Payout drill logic (pure). Puts 1–3 bets on the layout, deals a hand through the engine (`dealFromValues`,
 * so the third-card rules are the engine's) and asks for the net result under the active rules. Scenarios are
 * steered towards the cases people get wrong: ties, the EZ Dragon 7 push, Panda 8, pairs and the Super 6 half pay.
 */
import { BET_LABELS, BET_TYPES, DEFAULT_RULES, RANKS, SUITS, cardLabel, dealFromValues, formatMoney, isBetEnabled, limitsFor, settleBets } from '@/engine';
import type { BetSettlement, BetType, Bets, Card, HandResult, HandSettlement, Rank, Rng, TableRules } from '@/engine';
import { weightedIndex } from './seeds';

export type PayoutScenario = 'plain' | 'tie' | 'dragon7' | 'panda8' | 'pair' | 'banker6';

export interface PayoutQuestion {
  scenario: PayoutScenario;
  bets: Bets;
  result: HandResult;
  /** The answer: `settlement.net` is the net result of the hand. */
  settlement: HandSettlement;
  rules: TableRules;
}

export const MAIN_AMOUNTS: readonly number[] = [10, 20, 25, 50, 100, 200];
export const SIDE_AMOUNTS: readonly number[] = [5, 10, 25, 50];

/** Casino layout order of the betting spots. */
export const LAYOUT_ORDER: readonly BetType[] = ['playerPair', 'player', 'tie', 'banker', 'bankerPair', 'dragon7', 'panda8'];

function reSuit(cards: readonly Card[], rng: Rng): Card[] {
  return cards.map((c) => ({ rank: c.rank, suit: SUITS[rng.nextInt(SUITS.length)], id: c.id }));
}

/** A random hand dealt by the engine from random ranks (suits re-drawn for variety; they never affect play). */
export function randomDeal(rng: Rng, rules: TableRules = DEFAULT_RULES): HandResult {
  const rank = (): Rank => RANKS[rng.nextInt(RANKS.length)];
  const result = dealFromValues([rank(), rank(), rank()], [rank(), rank(), rank()], rules);
  return { ...result, playerCards: reSuit(result.playerCards, rng), bankerCards: reSuit(result.bankerCards, rng) };
}

const SCENARIO_TESTS: Readonly<Record<PayoutScenario, (r: HandResult) => boolean>> = {
  plain: () => true,
  tie: (r) => r.outcome === 'tie',
  dragon7: (r) => r.dragon7,
  panda8: (r) => r.panda8,
  pair: (r) => r.playerPair || r.bankerPair,
  banker6: (r) => r.bankerWinOn6,
};

function clampToLimits(bet: BetType, amount: number, rules: TableRules): number {
  const { min, max } = limitsFor(bet, rules);
  return Math.min(Math.max(amount, min), max);
}

export function generatePayoutQuestion(rng: Rng, rules: TableRules = DEFAULT_RULES): PayoutQuestion {
  const scenarios: PayoutScenario[] = ['plain', 'tie', 'dragon7', 'panda8', 'pair', 'banker6'];
  const weights = [30, 12, 18, 12, 14, rules.bankerRule === 'super6' ? 14 : 0];
  let scenario = scenarios[weightedIndex(weights, () => rng.next())];

  let result = randomDeal(rng, rules);
  const test = SCENARIO_TESTS[scenario];
  for (let tries = 0; tries < 600 && !test(result); tries++) result = randomDeal(rng, rules);
  if (!test(result)) scenario = 'plain';

  const bets: Bets = {};
  const chance = (p: number): boolean => rng.next() < p;
  const pick = (amounts: readonly number[]): number => amounts[rng.nextInt(amounts.length)];
  const add = (bet: BetType, amount: number): void => {
    if (!isBetEnabled(bet, rules) || bets[bet] !== undefined) return;
    bets[bet] = clampToLimits(bet, amount, rules);
  };
  const mainSide = (): BetType => (chance(0.5) ? 'player' : 'banker');
  const anyPair = (): BetType => (chance(0.5) ? 'playerPair' : 'bankerPair');

  switch (scenario) {
    case 'dragon7':
      add('banker', pick(MAIN_AMOUNTS));
      if (chance(0.65)) add('dragon7', pick(SIDE_AMOUNTS));
      if (chance(0.3)) add(chance(0.5) ? 'tie' : anyPair(), pick(SIDE_AMOUNTS));
      break;
    case 'panda8':
      if (chance(0.8)) add('player', pick(MAIN_AMOUNTS));
      if (chance(0.7)) add('panda8', pick(SIDE_AMOUNTS));
      if (chance(0.25)) add('dragon7', pick(SIDE_AMOUNTS));
      break;
    case 'tie':
      if (chance(0.6)) add('tie', pick([5, 10, 25]));
      if (chance(0.75)) add(mainSide(), pick(MAIN_AMOUNTS));
      if (chance(0.25)) add(anyPair(), pick(SIDE_AMOUNTS));
      break;
    case 'pair': {
      const hit: BetType = result.playerPair && result.bankerPair ? anyPair() : result.playerPair ? 'playerPair' : 'bankerPair';
      const other: BetType = hit === 'playerPair' ? 'bankerPair' : 'playerPair';
      if (chance(0.85)) add(hit, pick(SIDE_AMOUNTS));
      if (chance(0.3)) add(other, pick(SIDE_AMOUNTS));
      if (chance(0.7)) add(mainSide(), pick(MAIN_AMOUNTS));
      break;
    }
    case 'banker6':
      add('banker', pick(MAIN_AMOUNTS));
      if (chance(0.3)) add(chance(0.5) ? 'tie' : 'dragon7', pick(SIDE_AMOUNTS));
      break;
    case 'plain': {
      const count = 1 + weightedIndex([50, 35, 15], () => rng.next());
      const pool: BetType[] = ['player', 'banker', 'tie', 'dragon7', 'panda8', 'playerPair', 'bankerPair'];
      const poolWeights = [30, 35, 10, 8, 7, 5, 5];
      for (let i = 0; i < count; i++) {
        const bet = pool[weightedIndex(poolWeights, () => rng.next())];
        add(bet, bet === 'player' || bet === 'banker' ? pick(MAIN_AMOUNTS) : pick(SIDE_AMOUNTS));
      }
      break;
    }
  }
  if (Object.keys(bets).length === 0) add('player', pick(MAIN_AMOUNTS));

  return { scenario, bets, result, settlement: settleBets(bets, result, rules), rules };
}

/** "+$95", "$0", "−$5" (unicode minus for display). */
export function signedMoney(amount: number): string {
  if (amount > 0) return `+${formatMoney(amount)}`;
  if (amount < 0) return `−${formatMoney(-amount)}`;
  return formatMoney(0);
}

/** Dealer's call for the result: "Banker wins, 7 over 5" / "Tie, 6 and 6". */
export function describeOutcome(result: HandResult): string {
  if (result.outcome === 'tie') return `Tie, ${result.playerTotal} and ${result.bankerTotal}`;
  if (result.outcome === 'player') return `Player wins, ${result.playerTotal} over ${result.bankerTotal}`;
  return `Banker wins, ${result.bankerTotal} over ${result.playerTotal}`;
}

/** Bonus badges the dealer would call on this hand. */
export function outcomeBadges(result: HandResult): string[] {
  const badges: string[] = [];
  if (result.playerNatural) badges.push(`Natural ${result.playerTotal} — Player`);
  if (result.bankerNatural) badges.push(`Natural ${result.bankerTotal} — Banker`);
  if (result.dragon7) badges.push('Dragon 7');
  if (result.panda8) badges.push('Panda 8');
  if (result.playerPair) badges.push('Player Pair');
  if (result.bankerPair) badges.push('Banker Pair');
  return badges;
}

function pairText(cards: readonly Card[]): string {
  return `${cardLabel(cards[0])} ${cardLabel(cards[1])}`;
}

function percent(rate: number): string {
  const p = rate * 100;
  return `${Number.isInteger(p) ? p : p.toFixed(2)}%`;
}

/** One teaching sentence per settled bet. */
export function explainSettlement(s: BetSettlement, result: HandResult, rules: TableRules): string {
  const amount = formatMoney(s.amount);
  const net = signedMoney(s.net);
  const label = BET_LABELS[s.bet];
  switch (s.bet) {
    case 'player':
      if (s.result === 'win') return `Player wins — the Player bet pays 1:1: ${net}.`;
      if (s.result === 'push') return `Tie — Player and Banker bets push (your ${amount} is returned): ${net}.`;
      return `Banker wins — the Player bet loses: ${net}.`;
    case 'banker':
      if (s.result === 'push' && result.outcome === 'tie') return `Tie — Player and Banker bets push (your ${amount} is returned): ${net}.`;
      if (s.result === 'push') {
        return `Banker won with a THREE-card 7 — that is the Dragon 7. On an EZ table the Banker bet pushes instead of paying: ${net}. This push is the price of "no commission".`;
      }
      if (s.result === 'win') {
        if (rules.bankerRule === 'commission') {
          return `Banker wins — classic Banker pays 1:1 minus ${percent(rules.commissionRate)} commission: ${amount} − ${formatMoney(s.commission)} = ${net}.`;
        }
        if (rules.bankerRule === 'super6' && result.bankerTotal === 6) {
          return `Banker won with a 6 — under Super 6 that pays only 1:2 (half): ${net} on ${amount}.`;
        }
        if (rules.bankerRule === 'super6') return `Banker wins with ${result.bankerTotal} — Super 6 Banker pays 1:1 (only a winning 6 is halved): ${net}.`;
        if (result.bankerTotal === 7 && result.bankerCards.length === 2) {
          return `Banker wins with a TWO-card 7 — not a Dragon 7 (that needs three cards), so EZ Banker pays 1:1 in full: ${net}.`;
        }
        return `Banker wins — EZ Banker pays 1:1 with no commission: ${net}.`;
      }
      return `Player wins — the Banker bet loses: ${net}.`;
    case 'tie':
      if (s.result === 'win') return `Tie — the Tie bet pays ${rules.tiePays}:1: ${net} on ${amount}.`;
      return `No tie — the Tie bet loses: ${net}.`;
    case 'dragon7':
      if (s.result === 'win') return `Dragon 7 — Banker won with a three-card 7: pays ${rules.dragon7Pays}:1 → ${net} on ${amount}.`;
      if (result.outcome === 'tie' && result.bankerTotal === 7) return `A 7–7 tie is NOT a Dragon 7 (Banker must WIN with a three-card 7): the Dragon 7 bet loses, ${net}.`;
      if (result.outcome === 'banker' && result.bankerTotal === 7 && result.bankerCards.length === 2) {
        return `Banker won with a TWO-card 7 — not a Dragon 7 (it needs a THREE-card 7): the Dragon 7 bet loses, ${net}.`;
      }
      return `Banker did not win with a three-card 7 — the Dragon 7 bet loses: ${net}.`;
    case 'panda8':
      if (s.result === 'win') return `Panda 8 — Player won with a three-card 8: pays ${rules.panda8Pays}:1 → ${net} on ${amount}.`;
      if (result.outcome === 'tie' && result.playerTotal === 8) return `An 8–8 tie is NOT a Panda 8 (Player must WIN with a three-card 8): the Panda 8 bet loses, ${net}.`;
      if (result.outcome === 'player' && result.playerTotal === 8 && result.playerCards.length === 2) {
        return `Player won with a natural (two-card) 8 — not a Panda 8 (it needs a THREE-card 8): the Panda 8 bet loses, ${net}.`;
      }
      return `Player did not win with a three-card 8 — the Panda 8 bet loses: ${net}.`;
    case 'playerPair':
      if (s.result === 'win') return `Player’s first two cards are a pair (${pairText(result.playerCards)}): ${label} pays ${rules.pairPays}:1 → ${net}, whatever the outcome.`;
      return `Player’s first two cards (${pairText(result.playerCards)}) are not a pair: ${net}. Pairs are decided by the first two cards only; a third card never counts.`;
    case 'bankerPair':
      if (s.result === 'win') return `Banker’s first two cards are a pair (${pairText(result.bankerCards)}): ${label} pays ${rules.pairPays}:1 → ${net}, whatever the outcome.`;
      return `Banker’s first two cards (${pairText(result.bankerCards)}) are not a pair: ${net}. Pairs are decided by the first two cards only; a third card never counts.`;
  }
}

/** Parses what the player typed: "95", "-95", "+95", "$95", "−95", "(95)" (negative), "1,250.50". */
export function parseNetAnswer(text: string): number | null {
  let t = text.trim().replace(/[$,\s]/g, '').replace(/−/g, '-');
  if (t === '') return null;
  if (/^\(.*\)$/.test(t)) t = `-${t.slice(1, -1)}`;
  if (!/^[+-]?\d*(\.\d+)?$/.test(t) || !/\d/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function isNetCorrect(entered: number, net: number): boolean {
  return Math.abs(entered - net) < 0.005;
}

/** The settlements in casino layout order (for the breakdown table). */
export function settlementsInLayoutOrder(settlement: HandSettlement): BetSettlement[] {
  const order = new Map<BetType, number>(LAYOUT_ORDER.map((b, i) => [b, i]));
  return settlement.settlements.slice().sort((a, b) => (order.get(a.bet) ?? BET_TYPES.length) - (order.get(b.bet) ?? BET_TYPES.length));
}
