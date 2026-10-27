/**
 * Pure maths behind the lesson widgets. Everything derives from the engine's exact probabilities and the table's
 * actual payouts, so the lessons agree with the Coach and the Lab to the last digit.
 */
import { exactProbabilities, expectedValuePerUnit, type BetType, type TableRules } from '@/engine';

/** One possible result of a one-unit bet: its net value and probability. */
export interface BetOutcome {
  value: number;
  p: number;
}

/** The full net-result distribution of a one-unit bet under the given rules (probabilities sum to 1). */
export function betDistribution(bet: BetType, rules: TableRules): BetOutcome[] {
  const p = exactProbabilities(rules.decks);
  switch (bet) {
    case 'player':
      return [
        { value: 1, p: p.player },
        { value: 0, p: p.tie },
        { value: -1, p: p.banker },
      ];
    case 'banker':
      switch (rules.bankerRule) {
        case 'ez':
          return [
            { value: 1, p: p.banker - p.dragon7 },
            { value: 0, p: p.tie + p.dragon7 },
            { value: -1, p: p.player },
          ];
        case 'commission':
          return [
            { value: 1 - rules.commissionRate, p: p.banker },
            { value: 0, p: p.tie },
            { value: -1, p: p.player },
          ];
        case 'super6':
          return [
            { value: 1, p: p.banker - p.bankerWin6 },
            { value: 0.5, p: p.bankerWin6 },
            { value: 0, p: p.tie },
            { value: -1, p: p.player },
          ];
      }
      break;
    case 'tie':
      return [
        { value: rules.tiePays, p: p.tie },
        { value: -1, p: 1 - p.tie },
      ];
    case 'dragon7':
      return [
        { value: rules.dragon7Pays, p: p.dragon7 },
        { value: -1, p: 1 - p.dragon7 },
      ];
    case 'panda8':
      return [
        { value: rules.panda8Pays, p: p.panda8 },
        { value: -1, p: 1 - p.panda8 },
      ];
    case 'playerPair':
    case 'bankerPair':
      return [
        { value: rules.pairPays, p: p.pair },
        { value: -1, p: 1 - p.pair },
      ];
  }
  return [];
}

/** Mean net result of a one-unit bet (equals the engine's expectedValuePerUnit). */
export function betMean(bet: BetType, rules: TableRules): number {
  return betDistribution(bet, rules).reduce((sum, o) => sum + o.value * o.p, 0);
}

/** Variance of the net result of a one-unit bet. */
export function betVariance(bet: BetType, rules: TableRules): number {
  const mean = betMean(bet, rules);
  const second = betDistribution(bet, rules).reduce((sum, o) => sum + o.value * o.value * o.p, 0);
  return Math.max(0, second - mean * mean);
}

/** Standard deviation of the net result of a one-unit bet (the "swing" per hand). */
export function betStdDev(bet: BetType, rules: TableRules): number {
  return Math.sqrt(betVariance(bet, rules));
}

export interface SessionExpectation {
  hands: number;
  wagered: number;
  /** Expected net result (negative = expected loss). */
  expectedNet: number;
  /** One standard deviation of the session result. */
  stdDev: number;
  /** House edge as a positive fraction. */
  edge: number;
}

/** What a run of identical bets costs on average, and how far a typical session wanders from that. */
export function sessionExpectation(bet: BetType, amount: number, hands: number, rules: TableRules): SessionExpectation {
  const n = Math.max(0, hands);
  const a = Math.max(0, amount);
  const ev = expectedValuePerUnit(bet, rules);
  return {
    hands: n,
    wagered: a * n,
    expectedNet: ev * a * n,
    stdDev: betStdDev(bet, rules) * a * Math.sqrt(n),
    edge: -ev,
  };
}

/** Probability that an event with per-hand probability `p` happens at least once in `hands` hands. */
export function probAtLeastOne(p: number, hands: number): number {
  if (hands <= 0) return 0;
  return 1 - Math.pow(1 - p, hands);
}

/** Expected number of hands between hits of an event with probability `p` per hand. */
export function handsPerHit(p: number): number {
  return p > 0 ? 1 / p : Infinity;
}

/** The payout (to 1) at which a bet with win probability `p` would be a fair bet. */
export function fairOdds(p: number): number {
  return p > 0 ? (1 - p) / p : Infinity;
}

export interface MartingaleStats {
  /** Number of bets in a doubling sequence that stay within the table maximum. */
  steps: number;
  /** The bets of the sequence, unit first. */
  sequence: number[];
  /** Probability that a resolved hand (ties repeat the bet) loses. */
  loseProb: number;
  /** Probability that one sequence busts (every step loses). */
  bustProb: number;
  /** Expected number of sequences until a bust (1 / bustProb). */
  sequencesPerBust: number;
  /** Expected resolved hands per sequence. */
  handsPerSequence: number;
  /** Expected resolved hands until a bust. */
  handsPerBust: number;
  /** Amount lost when the sequence busts. */
  bustLoss: number;
  /** Expected net result of one sequence (negative). */
  expectedPerSequence: number;
}

/**
 * The arithmetic of a Martingale (double after every loss) on an even-money bet: how many doublings the table
 * maximum allows, how often the sequence busts, and what the bust costs.
 */
export function martingaleStats(unit: number, tableMax: number, winProb: number, loseProb: number, maxSteps = 60): MartingaleStats {
  const sequence: number[] = [];
  let bet = unit;
  while (bet <= tableMax && sequence.length < maxSteps && unit > 0) {
    sequence.push(bet);
    bet *= 2;
  }
  const steps = sequence.length;
  const resolved = winProb + loseProb;
  const q = resolved > 0 ? loseProb / resolved : 0;
  const bustProb = steps === 0 ? 1 : Math.pow(q, steps);
  const handsPerSequence = q === 1 ? steps : (1 - Math.pow(q, steps)) / (1 - q);
  const sequencesPerBust = bustProb > 0 ? 1 / bustProb : Infinity;
  const bustLoss = sequence.reduce((sum, b) => sum + b, 0);
  return {
    steps,
    sequence,
    loseProb: q,
    bustProb,
    sequencesPerBust,
    handsPerSequence,
    handsPerBust: sequencesPerBust * handsPerSequence,
    bustLoss,
    expectedPerSequence: (1 - bustProb) * unit - bustProb * bustLoss,
  };
}

/** Rounds to a number of significant decimals suitable for display. */
export function round(n: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
