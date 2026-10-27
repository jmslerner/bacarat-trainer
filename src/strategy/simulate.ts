/**
 * Monte Carlo simulation of a strategy (bet selector + betting system + side-bet policy) over many shoes.
 * One code path with Play mode: hands come from `dealHand` and are settled by `settleBets` (SPEC §5.3).
 * Synchronous and deterministic: trial `t` deals with `createRng(seed + t)`.
 */
import { cardValue, createRng, dealHand, roundCents, settleBets, Shoe, validateRules } from '@/engine';
import type { BetResult, Bets, HandResult, Outcome, StreakInfo } from '@/engine';
import { DRAGON7_COUNT, PANDA8_COUNT, trueCount } from './counting';
import { getSelector } from './selectors';
import { getSystem } from './systems';
import type { HistogramBin, SideBetMode, SideBetSimStats, SimConfig, SimResult, StrategyContext } from './types';

const FAST = { withSteps: false } as const;
/** Selectors that need randomness get their own stream, so every strategy sees the same cards for a seed. */
const SELECTOR_SEED_OFFSET = 0x9e3779b9;

export const DEFAULT_SAMPLE_CURVES = 20;
export const DEFAULT_CURVE_POINTS = 200;
const SIDE_BET_MODES: readonly SideBetMode[] = ['never', 'always', 'count'];

/** Human-readable problems with a configuration; [] when it can run. */
export function validateSimConfig(config: SimConfig): string[] {
  const problems: string[] = [];
  const positiveInt = (n: unknown): boolean => typeof n === 'number' && Number.isInteger(n) && n > 0;
  const positive = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!config.rules) problems.push('Rules are missing');
  else for (const p of validateRules(config.rules)) problems.push(`Rules: ${p}`);
  if (!config.strategy) {
    problems.push('Strategy is missing');
  } else {
    if (!getSelector(config.strategy.selectorId)) problems.push(`Unknown bet selector "${config.strategy.selectorId}"`);
    if (!getSystem(config.strategy.systemId)) problems.push(`Unknown betting system "${config.strategy.systemId}"`);
    if (!positive(config.strategy.unit)) problems.push('Unit must be a positive amount');
    const side = config.strategy.sideBets;
    if (!side) {
      problems.push('Side-bet policy is missing');
    } else {
      if (typeof side.units !== 'number' || !Number.isFinite(side.units) || side.units < 0) problems.push('Side-bet units must be zero or more');
      if (!SIDE_BET_MODES.includes(side.dragon7)) problems.push('Dragon 7 policy must be "never", "always" or "count"');
      if (!SIDE_BET_MODES.includes(side.panda8)) problems.push('Panda 8 policy must be "never", "always" or "count"');
    }
  }
  if (!positive(config.bankroll)) problems.push('Bankroll must be a positive amount');
  if (!positiveInt(config.shoesPerTrial)) problems.push('Shoes per trial must be a positive whole number');
  if (!positiveInt(config.trials)) problems.push('Trials must be a positive whole number');
  if (typeof config.seed !== 'number' || !Number.isFinite(config.seed)) problems.push('Seed must be a number');
  if (config.stopLoss !== undefined && !positive(config.stopLoss)) problems.push('Stop loss must be a positive amount');
  if (config.stopWin !== undefined && !positive(config.stopWin)) problems.push('Stop win must be a positive amount');
  if (config.sampleCurves !== undefined && !(Number.isInteger(config.sampleCurves) && config.sampleCurves >= 0)) problems.push('Sample curves must be a whole number');
  if (config.curvePoints !== undefined && !(Number.isInteger(config.curvePoints) && config.curvePoints >= 2)) problems.push('Curve points must be at least 2');
  return problems;
}

/** Big-road convention, identical to GameSession: a tie never breaks a Player/Banker streak. */
function nextStreak(prev: StreakInfo, outcome: Outcome): StreakInfo {
  if (outcome === 'tie') {
    return prev.outcome === null || prev.outcome === 'tie' ? { outcome: 'tie', length: prev.length + 1 } : prev;
  }
  return prev.outcome === outcome ? { outcome, length: prev.length + 1 } : { outcome, length: 1 };
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/** Linear-interpolated percentile of an ascending array (p in 0..100). */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pos = (clamp(p, 0, 100) / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** A "nice" bin width (1, 2, 2.5 or 5 × 10^k) giving about `targetBins` bins over `range`. */
export function niceStep(range: number, targetBins: number): number {
  if (!(range > 0)) return 1;
  const raw = range / Math.max(1, targetBins);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

/**
 * Histogram of money values (rounded to the cent) in nice, equal-width bins: [start, end), the last bin including
 * its end. Everything is computed in whole cents, so a value always lands in the bin whose edges contain it; the
 * bin width is never below one cent.
 */
export function buildHistogram(values: readonly number[], targetBins = 24): HistogramBin[] {
  if (values.length === 0) return [];
  const cents = new Array<number>(values.length);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const c = Math.round(roundCents(values[i]) * 100);
    cents[i] = c;
    if (c < min) min = c;
    if (c > max) max = c;
  }
  if (min === max) return [{ binStart: min / 100, binEnd: max / 100, count: values.length }];
  // A nice step in cents: at least one cent and a whole number of cents (2.5 cents becomes 5).
  let step = niceStep(max - min, targetBins);
  step = step < 1 ? 1 : Number.isInteger(step) ? step : Math.round(step * 2);
  const firstIndex = Math.floor(min / step);
  const binCount = Math.floor(max / step) - firstIndex + 1;
  const bins: HistogramBin[] = new Array<HistogramBin>(binCount);
  for (let i = 0; i < binCount; i++) {
    bins[i] = { binStart: ((firstIndex + i) * step) / 100, binEnd: ((firstIndex + i + 1) * step) / 100, count: 0 };
  }
  for (let i = 0; i < cents.length; i++) {
    const index = Math.floor(cents[i] / step) - firstIndex;
    bins[index < 0 ? 0 : index >= binCount ? binCount - 1 : index].count += 1;
  }
  return bins;
}

interface TrialOutcome {
  finalBankroll: number;
  ruined: boolean;
  maxDrawdown: number;
  /** Bankroll after every hand, index 0 = starting bankroll (only kept for sampled trials). */
  curve: number[] | null;
}

interface Accumulator {
  handsPlayed: number;
  handsBet: number;
  totalWagered: number;
  net: number;
  byOutcome: { player: number; banker: number; tie: number };
  sideBets: Record<'dragon7' | 'panda8', SideBetSimStats>;
}

function runTrial(config: SimConfig, trial: number, acc: Accumulator, keepCurve: boolean): TrialOutcome {
  const { rules, strategy } = config;
  const selector = getSelector(strategy.selectorId);
  const system = getSystem(strategy.systemId);
  if (!selector || !system) throw new Error('Unknown selector or system');
  const state = system.create(strategy.unit, strategy.systemParams);
  const rng = createRng(config.seed + trial);
  const selectorRng = createRng(config.seed + trial + SELECTOR_SEED_OFFSET);
  const unit = strategy.unit;
  const policy = strategy.sideBets;
  const sideAmount = policy.units * unit;
  const mainLimits = rules.limits.main;
  const sideLimits = rules.limits.side;
  const wantDragon = policy.units > 0 && rules.sideBets.dragon7 && policy.dragon7 !== 'never';
  const wantPanda = policy.units > 0 && rules.sideBets.panda8 && policy.panda8 !== 'never';
  const start = config.bankroll;
  const stopLossAt = config.stopLoss === undefined ? -Infinity : start - config.stopLoss;
  const stopWinAt = config.stopWin === undefined ? Infinity : start + config.stopWin;
  const d7Tags = DRAGON7_COUNT.tags;
  const p8Tags = PANDA8_COUNT.tags;

  let bankroll = start;
  let peak = start;
  let maxDrawdown = 0;
  let handsThisTrial = 0;
  let lastMainResult: BetResult | null = null;
  let ruined = false;
  let stopped = false;
  const curve: number[] | null = keepCurve ? [start] : null;

  for (let shoeNumber = 1; shoeNumber <= config.shoesPerTrial && !ruined && !stopped; shoeNumber++) {
    const shoe = new Shoe(rules, rng, shoeNumber);
    const history: HandResult[] = [];
    let streak: StreakInfo = { outcome: null, length: 0 };
    let lastOutcome: Outcome | null = null;
    let d7Running = 0;
    let p8Running = 0;
    if (shoe.exposedBurnCard) {
      const v = cardValue(shoe.exposedBurnCard.rank);
      d7Running = d7Tags[v];
      p8Running = p8Tags[v];
    }
    let finalHand = false;

    for (let handNumber = 1; ; handNumber++) {
      const cardsRemaining = shoe.cardsRemaining();
      if (cardsRemaining < 6) break; // unreachable with validated rules; keeps custom rules safe
      const d7True = trueCount(d7Running, cardsRemaining);
      const p8True = trueCount(p8Running, cardsRemaining);
      const ctx: StrategyContext = {
        shoeHistory: history,
        lastOutcome,
        streak,
        shoe: { cardsRemaining, decksRemaining: cardsRemaining / 52, cutCardReached: shoe.cutCardReached },
        counts: {
          dragon7: { running: d7Running, trueCount: d7True },
          panda8: { running: p8Running, trueCount: p8True },
        },
        bankroll,
        unit,
        sessionNet: roundCents(bankroll - start),
        handsPlayed: handsThisTrial,
        lastMainResult,
        rules,
        rng: selectorRng,
      };
      const choice = selector.select(ctx);

      const bets: Bets = {};
      let mainAmount = 0;
      if (choice !== 'skip') {
        if (bankroll < mainLimits.min) {
          ruined = true; // cannot cover the table minimum for the bet the strategy wants
          break;
        }
        mainAmount = Math.min(bankroll, clamp(state.nextBet(), mainLimits.min, mainLimits.max));
        bets[choice] = mainAmount;
      }
      let remaining = bankroll - mainAmount;
      if (wantDragon && (policy.dragon7 === 'always' || d7True >= DRAGON7_COUNT.threshold) && remaining >= sideLimits.min) {
        const amount = Math.min(remaining, clamp(sideAmount, sideLimits.min, sideLimits.max));
        bets.dragon7 = amount;
        remaining -= amount;
      }
      if (wantPanda && (policy.panda8 === 'always' || p8True >= PANDA8_COUNT.threshold) && remaining >= sideLimits.min) {
        const amount = Math.min(remaining, clamp(sideAmount, sideLimits.min, sideLimits.max));
        bets.panda8 = amount;
        remaining -= amount;
      }

      const result = dealHand(shoe, rules, handNumber, FAST);
      const settlement = settleBets(bets, result, rules);
      bankroll = roundCents(bankroll + settlement.net);
      handsThisTrial++;
      acc.handsPlayed++;
      acc.byOutcome[result.outcome]++;
      if (settlement.totalWagered > 0) {
        acc.handsBet++;
        acc.totalWagered += settlement.totalWagered;
        acc.net += settlement.net;
      }
      for (const s of settlement.settlements) {
        if (s.bet === choice) {
          state.record(s.result);
          lastMainResult = s.result;
        } else if (s.bet === 'dragon7' || s.bet === 'panda8') {
          const stat = acc.sideBets[s.bet];
          stat.bets++;
          stat.wagered += s.amount;
          stat.net += s.net;
          if (s.result === 'win') stat.wins++;
        }
      }

      // Every face-up card of the hand goes into both counts, as a player at the table would do.
      for (let i = 0; i < result.playerCards.length; i++) {
        const v = cardValue(result.playerCards[i].rank);
        d7Running += d7Tags[v];
        p8Running += p8Tags[v];
      }
      for (let i = 0; i < result.bankerCards.length; i++) {
        const v = cardValue(result.bankerCards[i].rank);
        d7Running += d7Tags[v];
        p8Running += p8Tags[v];
      }
      history.push(result);
      streak = nextStreak(streak, result.outcome);
      lastOutcome = result.outcome;
      if (curve) curve.push(bankroll);
      if (bankroll > peak) peak = bankroll;
      const drawdown = peak - bankroll;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      if (bankroll <= 0 || bankroll <= stopLossAt) {
        ruined = true;
        break;
      }
      if (bankroll >= stopWinAt) {
        stopped = true;
        break;
      }
      if (finalHand) break;
      if (result.cutCardDrawn) finalHand = true; // the hand after the cut card is the last of the shoe
    }
  }

  return { finalBankroll: bankroll, ruined, maxDrawdown: roundCents(maxDrawdown), curve };
}

/** Resamples per-hand curves onto `points` evenly spaced hands over the longest trial (early finishers hold their final value). */
function resampleCurves(curves: readonly (readonly number[])[], points: number): { sampleCurves: number[][]; curveHands: number } {
  let curveHands = 0;
  for (const c of curves) curveHands = Math.max(curveHands, c.length - 1);
  const sampleCurves = curves.map((c) => {
    const out = new Array<number>(points);
    for (let i = 0; i < points; i++) {
      const hand = curveHands === 0 ? 0 : Math.round((i * curveHands) / (points - 1));
      out[i] = c[Math.min(hand, c.length - 1)];
    }
    return out;
  });
  return { sampleCurves, curveHands };
}

/**
 * Runs every trial synchronously and returns the aggregate statistics. Throws on an invalid configuration.
 * `onProgress(done, total)` is called about a hundred times over the run (and at the end).
 */
export function runSimulation(config: SimConfig, onProgress?: (done: number, total: number) => void): SimResult {
  const problems = validateSimConfig(config);
  if (problems.length > 0) throw new Error(`Invalid simulation config: ${problems.join('; ')}`);
  const started = performance.now();
  const trials = config.trials;
  const sampleCount = Math.min(config.sampleCurves ?? DEFAULT_SAMPLE_CURVES, trials);
  const curvePoints = config.curvePoints ?? DEFAULT_CURVE_POINTS;
  const acc: Accumulator = {
    handsPlayed: 0,
    handsBet: 0,
    totalWagered: 0,
    net: 0,
    byOutcome: { player: 0, banker: 0, tie: 0 },
    sideBets: {
      dragon7: { bets: 0, wins: 0, wagered: 0, net: 0 },
      panda8: { bets: 0, wins: 0, wagered: 0, net: 0 },
    },
  };
  const finals: number[] = new Array<number>(trials);
  const curves: number[][] = [];
  let ruinCount = 0;
  let profitCount = 0;
  let drawdownSum = 0;
  let worstDrawdown = 0;
  const progressStep = Math.max(1, Math.floor(trials / 100));

  for (let trial = 0; trial < trials; trial++) {
    const outcome = runTrial(config, trial, acc, trial < sampleCount);
    finals[trial] = outcome.finalBankroll;
    if (outcome.ruined) ruinCount++;
    if (outcome.finalBankroll > config.bankroll) profitCount++;
    drawdownSum += outcome.maxDrawdown;
    if (outcome.maxDrawdown > worstDrawdown) worstDrawdown = outcome.maxDrawdown;
    if (outcome.curve) curves.push(outcome.curve);
    const done = trial + 1;
    if (onProgress && (done % progressStep === 0 || done === trials)) onProgress(done, trials);
  }

  const sorted = finals.slice().sort((a, b) => a - b);
  let sum = 0;
  for (const v of finals) sum += v;
  const meanFinal = sum / trials;
  let variance = 0;
  for (const v of finals) variance += (v - meanFinal) * (v - meanFinal);
  const { sampleCurves, curveHands } = resampleCurves(curves, curvePoints);
  const roundStat = (s: SideBetSimStats): SideBetSimStats => ({ ...s, wagered: roundCents(s.wagered), net: roundCents(s.net) });
  const totalWagered = roundCents(acc.totalWagered);
  const net = roundCents(acc.net);

  return {
    config,
    trials,
    handsPlayed: acc.handsPlayed,
    handsBet: acc.handsBet,
    totalWagered,
    net,
    realizedEdge: totalWagered > 0 ? -net / totalWagered : 0,
    meanFinal: roundCents(meanFinal),
    medianFinal: roundCents(percentile(sorted, 50)),
    stdFinal: roundCents(Math.sqrt(variance / trials)),
    percentiles: {
      p5: roundCents(percentile(sorted, 5)),
      p25: roundCents(percentile(sorted, 25)),
      p50: roundCents(percentile(sorted, 50)),
      p75: roundCents(percentile(sorted, 75)),
      p95: roundCents(percentile(sorted, 95)),
    },
    pProfit: profitCount / trials,
    pRuin: ruinCount / trials,
    meanMaxDrawdown: roundCents(drawdownSum / trials),
    worstDrawdown: roundCents(worstDrawdown),
    histogram: buildHistogram(finals),
    sampleCurves,
    curveHands,
    sideBets: { dragon7: roundStat(acc.sideBets.dragon7), panda8: roundStat(acc.sideBets.panda8) },
    byOutcome: acc.byOutcome,
    elapsedMs: performance.now() - started,
  };
}
