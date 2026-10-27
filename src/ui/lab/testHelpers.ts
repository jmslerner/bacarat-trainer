/** Test-only: a complete SimResult built from a few overrides (never exported from the barrel). */
import { DEFAULT_RULES, cloneRules } from '@/engine';
import type { SimConfig, SimResult } from '@/strategy';

export function fakeConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    rules: cloneRules(DEFAULT_RULES),
    strategy: { selectorId: 'alwaysBanker', systemId: 'flat', systemParams: {}, unit: 10, sideBets: { dragon7: 'never', panda8: 'never', units: 1 } },
    bankroll: 1000,
    shoesPerTrial: 10,
    trials: 100,
    seed: 1,
    ...overrides,
  };
}

export function fakeResult(overrides: Partial<SimResult> = {}, config: Partial<SimConfig> = {}): SimResult {
  const cfg = fakeConfig(config);
  return {
    config: cfg,
    trials: cfg.trials,
    handsPlayed: 81_000,
    handsBet: 81_000,
    totalWagered: 810_000,
    net: -8_300,
    realizedEdge: 8_300 / 810_000,
    meanFinal: 917,
    medianFinal: 925,
    stdFinal: 260,
    percentiles: { p5: 480, p25: 760, p50: 925, p75: 1090, p95: 1320 },
    pProfit: 0.38,
    pRuin: 0.02,
    meanMaxDrawdown: 310,
    worstDrawdown: 1000,
    histogram: [
      { binStart: 400, binEnd: 600, count: 5 },
      { binStart: 600, binEnd: 800, count: 20 },
      { binStart: 800, binEnd: 1000, count: 40 },
      { binStart: 1000, binEnd: 1200, count: 30 },
      { binStart: 1200, binEnd: 1400, count: 5 },
    ],
    sampleCurves: [
      [1000, 1010, 990, 1020, 1040],
      [1000, 990, 970, 950, 900],
      [1000, 1000, 1000, 1000, 1000],
    ],
    curveHands: 800,
    sideBets: { dragon7: { bets: 0, wins: 0, wagered: 0, net: 0 }, panda8: { bets: 0, wins: 0, wagered: 0, net: 0 } },
    byOutcome: { player: 36_146, banker: 37_146, tie: 7_708 },
    elapsedMs: 512,
    ...overrides,
  };
}
