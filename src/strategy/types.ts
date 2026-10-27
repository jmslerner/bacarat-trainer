/**
 * `@/strategy` contract (SPEC §5.3): bet selectors, betting systems, counting systems and the Monte Carlo
 * simulator. Pure TypeScript; the only runtime dependency is `@/engine`.
 */
import type { BetResult, HandResult, Outcome, Rng, StreakInfo, TableRules } from '@/engine';

/** What a bet selector wants to do with the main bet this hand. */
export type MainChoice = 'player' | 'banker' | 'skip';

/** A card count as a player at the table would keep it. */
export interface CountState {
  running: number;
  /** running ÷ max(decks remaining, 0.5). */
  trueCount: number;
}

/** Everything a selector may look at before the next hand. */
export interface StrategyContext {
  /** Results of the current shoe so far, in order. */
  shoeHistory: readonly HandResult[];
  lastOutcome: Outcome | null;
  /** Big-road convention: a tie never breaks a Player/Banker streak (same as `SessionStats.currentStreak`). */
  streak: StreakInfo;
  shoe: { cardsRemaining: number; decksRemaining: number; cutCardReached: boolean };
  counts: { dragon7: CountState; panda8: CountState };
  bankroll: number;
  unit: number;
  /** bankroll − starting bankroll. */
  sessionNet: number;
  /** Hands dealt so far this session (all shoes), whether or not a bet was placed. */
  handsPlayed: number;
  /** Result of the most recent main bet placed (null before the first one). */
  lastMainResult: BetResult | null;
  rules: TableRules;
  /**
   * Seeded randomness for selectors that need it (the simulator supplies one per trial, separate from the shoe's
   * RNG so every strategy sees the same cards for the same seed). Optional: selectors must cope without it.
   */
  rng?: Rng;
}

export interface BetSelector {
  id: string;
  name: string;
  description: string;
  select(ctx: StrategyContext): MainChoice;
}

/** Describes one numeric parameter of a betting system so the Lab can render an input for it. */
export interface SystemParamSpec {
  key: string;
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface SystemState {
  /** The amount (in money, not units) the system wants to bet next. The simulator clamps it to the table and bankroll. */
  nextBet(): number;
  record(result: BetResult): void;
  reset(): void;
  /** Where the system is in its progression (0 = base bet), for display. */
  readonly progressionIndex?: number;
}

export interface BettingSystem {
  id: string;
  name: string;
  description: string;
  /** Tunable parameters (may be empty). Keys are the `params` keys accepted by `create`. */
  params: readonly SystemParamSpec[];
  create(unit: number, params?: Record<string, number>): SystemState;
}

export interface CountSystem {
  id: string;
  name: string;
  description: string;
  /** Tag per card VALUE: index 0 = 10/J/Q/K, 1 = Ace, 2..9. Balanced over the shoe. */
  tags: number[];
  /** Bet the side bet when the true count is at or above this. */
  threshold: number;
}

export type SideBetMode = 'never' | 'always' | 'count';

export interface SideBetPolicy {
  dragon7: SideBetMode;
  panda8: SideBetMode;
  /** Side bets are placed at `units × unit`. */
  units: number;
}

export interface StrategyConfig {
  selectorId: string;
  systemId: string;
  systemParams?: Record<string, number>;
  /** Base bet in money. */
  unit: number;
  sideBets: SideBetPolicy;
}

export interface SimConfig {
  rules: TableRules;
  strategy: StrategyConfig;
  /** Starting bankroll of every trial. */
  bankroll: number;
  shoesPerTrial: number;
  trials: number;
  /** Trial `t` deals its shoes with `createRng(seed + t)`, so the same seed always reproduces the same result. */
  seed: number;
  /** Stop a trial (counted as ruin) once it is down this much from the starting bankroll. */
  stopLoss?: number;
  /** Stop a trial once it is up this much from the starting bankroll. */
  stopWin?: number;
  /** How many trials keep a bankroll curve (default 20). */
  sampleCurves?: number;
  /** Points per sampled curve (default 200). */
  curvePoints?: number;
}

export interface HistogramBin {
  binStart: number;
  /** Exclusive, except for the last bin which includes its end. */
  binEnd: number;
  count: number;
}

export interface SideBetSimStats {
  bets: number;
  wins: number;
  wagered: number;
  net: number;
}

export interface SimResult {
  config: SimConfig;
  trials: number;
  /** Hands dealt over all trials (including hands sat out). */
  handsPlayed: number;
  /** Hands on which at least one bet was placed. */
  handsBet: number;
  totalWagered: number;
  net: number;
  /** −net ÷ totalWagered (0 when nothing was wagered). Positive = the house won. */
  realizedEdge: number;
  meanFinal: number;
  medianFinal: number;
  /** Population standard deviation of the final bankrolls. */
  stdFinal: number;
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  /** Share of trials that ended above the starting bankroll. */
  pProfit: number;
  /** Share of trials that ended in ruin: bankroll at 0, below the table minimum for the wanted bet, or at the stop loss. */
  pRuin: number;
  meanMaxDrawdown: number;
  worstDrawdown: number;
  histogram: HistogramBin[];
  /**
   * Bankroll curves of the first `sampleCurves` trials, each `curvePoints` long: point `i` is the bankroll after
   * hand `round(i × curveHands ÷ (curvePoints − 1))`. A trial that ended early holds its final value.
   */
  sampleCurves: number[][];
  /** Hands spanned by the curves' x-axis (the longest sampled trial). */
  curveHands: number;
  sideBets: Record<'dragon7' | 'panda8', SideBetSimStats>;
  byOutcome: { player: number; banker: number; tie: number };
  elapsedMs: number;
}

/** Simulated EV of a side bet for hands whose true count fell in [tcMin, tcMax). */
export interface CountEvRow {
  tcMin: number;
  /** Exclusive; Infinity for the top bucket. */
  tcMax: number;
  hands: number;
  /** Share of all hands dealt. */
  frequency: number;
  /** Per unit wagered, e.g. +0.03 = a 3% player edge. */
  ev: number;
}
