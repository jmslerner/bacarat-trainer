import { describe, expect, it } from 'vitest';
import { cardValue, cloneRules, createRng, dealHand, DEFAULT_RULES, houseEdge, roundCents, Shoe } from '@/engine';
import type { StreakInfo } from '@/engine';
import { DRAGON7_COUNT, PANDA8_COUNT, trueCount } from './counting';
import { buildHistogram, niceStep, percentile, runSimulation, validateSimConfig } from './simulate';
import type { SimConfig, SimResult } from './types';

function config(overrides: Partial<SimConfig> = {}, strategy: Partial<SimConfig['strategy']> = {}): SimConfig {
  return {
    rules: DEFAULT_RULES,
    strategy: { selectorId: 'alwaysBanker', systemId: 'flat', unit: 10, sideBets: { dragon7: 'never', panda8: 'never', units: 1 }, ...strategy },
    bankroll: 1000,
    shoesPerTrial: 2,
    trials: 5,
    seed: 42,
    ...overrides,
  };
}

const withoutTime = (r: SimResult): Omit<SimResult, 'elapsedMs'> => {
  const { elapsedMs: _ignored, ...rest } = r;
  return rest;
};

describe('runSimulation', () => {
  it('is deterministic: the same seed gives an identical result, a different seed does not', () => {
    const a = runSimulation(config({ trials: 8, shoesPerTrial: 3 }));
    const b = runSimulation(config({ trials: 8, shoesPerTrial: 3 }));
    expect(withoutTime(a)).toEqual(withoutTime(b));
    const c = runSimulation(config({ trials: 8, shoesPerTrial: 3, seed: 43 }));
    expect(c.net).not.toBe(a.net);
    expect(a.handsPlayed).toBeGreaterThan(8 * 3 * 70);
    expect(a.handsPlayed).toBeLessThan(8 * 3 * 100);
  });

  it('realizes the exact EZ Banker edge with flat always-Banker betting over more than 1,000,000 hands', () => {
    const result = runSimulation(config({ trials: 100, shoesPerTrial: 150, bankroll: 1e7, seed: 2026 }));
    expect(result.handsPlayed).toBeGreaterThan(1_000_000);
    expect(result.handsBet).toBe(result.handsPlayed);
    expect(result.totalWagered).toBe(result.handsPlayed * 10);
    expect(Math.abs(result.realizedEdge - houseEdge('banker', DEFAULT_RULES))).toBeLessThan(0.003);
    expect(result.pRuin).toBe(0);
    expect(result.sideBets.dragon7.bets).toBe(0);
    expect(result.sideBets.panda8.bets).toBe(0);
    const total = result.byOutcome.player + result.byOutcome.banker + result.byOutcome.tie;
    expect(total).toBe(result.handsPlayed);
    expect(result.byOutcome.banker / total).toBeCloseTo(0.4586, 2);
    expect(result.byOutcome.tie / total).toBeCloseTo(0.0952, 2);
  });

  it('martingale ruins far more often than flat betting with the same bankroll', () => {
    const base = { trials: 300, shoesPerTrial: 10, bankroll: 1000, seed: 7 };
    const flat = runSimulation(config(base));
    const martingale = runSimulation(config(base, { systemId: 'martingale', systemParams: { maxDoublings: 10 } }));
    expect(flat.pRuin).toBeLessThan(0.05);
    expect(martingale.pRuin).toBeGreaterThan(flat.pRuin + 0.2);
    expect(martingale.worstDrawdown).toBeGreaterThan(flat.worstDrawdown);
    for (const r of [flat, martingale]) {
      expect(r.pRuin).toBeGreaterThanOrEqual(0);
      expect(r.pRuin).toBeLessThanOrEqual(1);
      expect(r.pProfit).toBeGreaterThanOrEqual(0);
      expect(r.histogram.reduce((n, b) => n + b.count, 0)).toBe(r.trials);
      const p = r.percentiles;
      expect(p.p5).toBeLessThanOrEqual(p.p25);
      expect(p.p25).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p75);
      expect(p.p75).toBeLessThanOrEqual(p.p95);
      expect(p.p50).toBe(r.medianFinal);
      expect(r.percentiles.p5).toBeGreaterThanOrEqual(0); // a bankroll can never go negative
    }
  });

  it('places Dragon 7 bets exactly on the hands where the true count is at or above 4', () => {
    const cfg = config({ trials: 1, shoesPerTrial: 20, bankroll: 1e6, seed: 11 }, { sideBets: { dragon7: 'count', panda8: 'never', units: 2 } });
    const result = runSimulation(cfg);
    // Independent replay of trial 0: same RNG, same shoes, the count kept by hand.
    const rng = createRng(cfg.seed);
    let expectedBets = 0;
    let expectedWins = 0;
    let hands = 0;
    for (let shoeNumber = 1; shoeNumber <= cfg.shoesPerTrial; shoeNumber++) {
      const shoe = new Shoe(DEFAULT_RULES, rng, shoeNumber);
      let running = shoe.exposedBurnCard ? DRAGON7_COUNT.tags[cardValue(shoe.exposedBurnCard.rank)] : 0;
      let finalHand = false;
      for (let n = 1; ; n++) {
        const bet = trueCount(running, shoe.cardsRemaining()) >= 4;
        const r = dealHand(shoe, DEFAULT_RULES, n, { withSteps: false });
        hands++;
        if (bet) {
          expectedBets++;
          if (r.dragon7) expectedWins++;
        }
        for (const c of [...r.playerCards, ...r.bankerCards]) running += DRAGON7_COUNT.tags[cardValue(c.rank)];
        if (finalHand) break;
        if (r.cutCardDrawn) finalHand = true;
      }
    }
    expect(result.handsPlayed).toBe(hands);
    expect(result.sideBets.dragon7.bets).toBe(expectedBets);
    expect(result.sideBets.dragon7.wins).toBe(expectedWins);
    expect(result.sideBets.dragon7.wagered).toBe(expectedBets * 20);
    expect(result.sideBets.dragon7.net).toBe(expectedWins * 20 * 40 - (expectedBets - expectedWins) * 20);
    expect(expectedBets).toBeGreaterThan(hands * 0.05);
    expect(expectedBets).toBeLessThan(hands * 0.2);
    expect(result.totalWagered).toBe(result.handsPlayed * 10 + expectedBets * 20);
  });

  it("'always' bets every hand, 'never' and a table without the bet place nothing", () => {
    const always = runSimulation(config({ trials: 2, bankroll: 1e6 }, { sideBets: { dragon7: 'always', panda8: 'always', units: 1 } }));
    expect(always.sideBets.dragon7.bets).toBe(always.handsPlayed);
    expect(always.sideBets.panda8.bets).toBe(always.handsPlayed);
    expect(always.sideBets.panda8.wagered).toBe(always.handsPlayed * 10);
    const rules = cloneRules(DEFAULT_RULES);
    rules.sideBets.dragon7 = false;
    const off = runSimulation(config({ trials: 2, rules }, { sideBets: { dragon7: 'always', panda8: 'always', units: 1 } }));
    expect(off.sideBets.dragon7.bets).toBe(0);
    expect(off.sideBets.panda8.bets).toBeGreaterThan(0);
    const zero = runSimulation(config({ trials: 2 }, { sideBets: { dragon7: 'always', panda8: 'always', units: 0 } }));
    expect(zero.sideBets.dragon7.bets + zero.sideBets.panda8.bets).toBe(0);
  });

  it('a selector that sits out still sees the whole shoe dealt', () => {
    const r = runSimulation(config({ trials: 3, shoesPerTrial: 2 }, { selectorId: 'followAfterN' }));
    expect(r.handsBet).toBeGreaterThan(0);
    expect(r.handsBet).toBeLessThan(r.handsPlayed / 2);
    expect(r.totalWagered).toBe(r.handsBet * 10);
  });

  it('clamps bets to the table limits and the bankroll', () => {
    const small = runSimulation(config({ trials: 2, shoesPerTrial: 1 }, { unit: 1 })); // below the $10 minimum
    expect(small.totalWagered).toBe(small.handsBet * 10);
    const huge = runSimulation(config({ trials: 2, shoesPerTrial: 1, bankroll: 1e6 }, { unit: 20000 })); // above the $5,000 maximum
    expect(huge.totalWagered).toBe(huge.handsBet * 5000);
    const poor = runSimulation(config({ trials: 10, shoesPerTrial: 1, bankroll: 15 }));
    expect(poor.pRuin).toBe(1); // $15 at a $10 minimum: one loss (or the second bet) ends it
    expect(poor.percentiles.p95).toBeLessThanOrEqual(45);
  });

  it('honours stop loss and stop win and counts a stop loss as ruin', () => {
    const r = runSimulation(config({ trials: 40, shoesPerTrial: 5, stopLoss: 100, stopWin: 50, seed: 5 }));
    for (const curve of r.sampleCurves) {
      expect(Math.min(...curve)).toBeGreaterThanOrEqual(890); // −100 stop, at most one more $10 bet
      expect(Math.max(...curve)).toBeLessThanOrEqual(1060);
    }
    expect(r.percentiles.p5).toBeGreaterThanOrEqual(890);
    expect(r.pRuin + r.pProfit).toBeGreaterThan(0.5); // most trials hit one of the stops within 5 shoes
    expect(r.pRuin).toBeGreaterThan(0);
  });

  it('samples bankroll curves on a common hand axis, starting at the bankroll', () => {
    const r = runSimulation(config({ trials: 6, shoesPerTrial: 1, sampleCurves: 4, curvePoints: 50 }));
    expect(r.sampleCurves.length).toBe(4);
    for (const curve of r.sampleCurves) {
      expect(curve.length).toBe(50);
      expect(curve[0]).toBe(1000);
    }
    expect(r.curveHands).toBeGreaterThan(60);
    const all = runSimulation(config({ trials: 3, shoesPerTrial: 1 }));
    expect(all.sampleCurves.length).toBe(3);
    expect(all.sampleCurves[0].length).toBe(200);
  });

  it('reports progress up to the number of trials and rejects invalid configs', () => {
    const calls: [number, number][] = [];
    runSimulation(config({ trials: 7, shoesPerTrial: 1 }), (done, total) => calls.push([done, total]));
    expect(calls[calls.length - 1]).toEqual([7, 7]);
    for (let i = 1; i < calls.length; i++) expect(calls[i][0]).toBeGreaterThan(calls[i - 1][0]);
    expect(validateSimConfig(config())).toEqual([]);
    expect(validateSimConfig(config({ trials: 0 }))).toContain('Trials must be a positive whole number');
    expect(validateSimConfig(config({}, { selectorId: 'nope' }))[0]).toMatch(/Unknown bet selector/);
    expect(() => runSimulation(config({ bankroll: -1 }))).toThrow(/Invalid simulation config/);
    expect(() => runSimulation(config({}, { systemId: 'nope' }))).toThrow(/Unknown betting system/);
    const badRules = cloneRules(DEFAULT_RULES);
    badRules.decks = 5 as 6;
    expect(validateSimConfig(config({ rules: badRules }))[0]).toMatch(/^Rules:/);
  });

  it('every selector and every system run end to end', () => {
    for (const selectorId of ['alwaysPlayer', 'followLast', 'betAgainstLast', 'alternate', 'bigRoadTrend', 'random']) {
      const r = runSimulation(config({ trials: 2, shoesPerTrial: 1 }, { selectorId }));
      expect(r.handsBet).toBe(r.handsPlayed);
    }
    for (const systemId of ['grandMartingale', 'paroli', 'oneThreeTwoSix', 'fibonacci', 'dAlembert', 'labouchere', 'oscarsGrind']) {
      const r = runSimulation(config({ trials: 2, shoesPerTrial: 1, bankroll: 1e5 }, { systemId }));
      expect(r.totalWagered).toBeGreaterThan(r.handsBet * 10);
    }
  });

  it('runs 1000 trials × 10 shoes well under 20 seconds', () => {
    const r = runSimulation(config({ trials: 1000, shoesPerTrial: 10, bankroll: 1e6, seed: 1 }, { sideBets: { dragon7: 'count', panda8: 'count', units: 1 } }));
    expect(r.handsPlayed).toBeGreaterThan(700_000);
    expect(r.elapsedMs).toBeLessThan(20_000);
    // eslint-disable-next-line no-console
    console.log(`perf: ${r.trials} trials × ${r.config.shoesPerTrial} shoes = ${r.handsPlayed} hands in ${r.elapsedMs.toFixed(0)} ms`);
  });
});

describe('statistics helpers', () => {
  it('percentile interpolates linearly', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 100)).toBe(4);
    expect(percentile([10], 37)).toBe(10);
    expect(percentile([], 50)).toBe(0);
  });

  it('niceStep picks 1 / 2 / 2.5 / 5 × 10^k', () => {
    expect(niceStep(1000, 10)).toBe(100);
    expect(niceStep(2300, 10)).toBe(250);
    expect(niceStep(4800, 10)).toBe(500);
    expect(niceStep(0, 10)).toBe(1);
  });

  it('buildHistogram covers every value with equal nice bins', () => {
    const bins = buildHistogram([0, 10, 20, 30, 1000], 10);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(5);
    expect(bins[0].binStart).toBe(0);
    expect(bins[bins.length - 1].binEnd).toBeGreaterThanOrEqual(1000);
    for (let i = 1; i < bins.length; i++) expect(bins[i].binStart).toBe(bins[i - 1].binEnd);
    expect(buildHistogram([5, 5, 5])).toEqual([{ binStart: 5, binEnd: 5, count: 3 }]);
    expect(buildHistogram([])).toEqual([]);
  });
});

describe('runSimulation (review additions)', () => {
  it('rejects an unknown side-bet policy', () => {
    const bad = config({}, { sideBets: { dragon7: 'sometimes' as 'count', panda8: 'never', units: 1 } });
    expect(validateSimConfig(bad)).toEqual(['Dragon 7 policy must be "never", "always" or "count"']);
    expect(() => runSimulation(bad)).toThrow(/Dragon 7 policy/);
  });

  it('deals the same cards to every strategy for a seed, and the random selector is reproducible', () => {
    const base = { trials: 6, shoesPerTrial: 2, seed: 99, bankroll: 1e6 }; // nobody is ruined, so every trial deals every shoe
    const banker = runSimulation(config(base));
    const random = runSimulation(config(base, { selectorId: 'random' }));
    const chop = runSimulation(config(base, { selectorId: 'betAgainstLast', systemId: 'fibonacci' }));
    expect(random.byOutcome).toEqual(banker.byOutcome);
    expect(chop.byOutcome).toEqual(banker.byOutcome);
    expect(random.handsPlayed).toBe(banker.handsPlayed);
    expect(random.net).not.toBe(banker.net);
    expect(withoutTime(runSimulation(config(base, { selectorId: 'random' })))).toEqual(withoutTime(random));
  });

  it('places both count-based side bets and the streak selector exactly as an independent replay predicts', () => {
    const cfg = config({ trials: 1, shoesPerTrial: 20, bankroll: 1e6, seed: 23 }, { selectorId: 'followAfterN', sideBets: { dragon7: 'count', panda8: 'count', units: 2 } });
    const result = runSimulation(cfg);
    // Replay trial 0 with the engine alone: same RNG and shoes, both counts and the big-road streak kept by hand.
    const rng = createRng(cfg.seed);
    const exp = { hands: 0, mainBets: 0, handsBet: 0, d7: { bets: 0, wins: 0 }, p8: { bets: 0, wins: 0 } };
    for (let shoeNumber = 1; shoeNumber <= cfg.shoesPerTrial; shoeNumber++) {
      const shoe = new Shoe(DEFAULT_RULES, rng, shoeNumber);
      let d7 = 0;
      let p8 = 0;
      if (shoe.exposedBurnCard) {
        const v = cardValue(shoe.exposedBurnCard.rank);
        d7 = DRAGON7_COUNT.tags[v];
        p8 = PANDA8_COUNT.tags[v];
      }
      let streak: StreakInfo = { outcome: null, length: 0 };
      let finalHand = false;
      for (let n = 1; ; n++) {
        const remaining = shoe.cardsRemaining();
        const betMain = streak.outcome !== null && streak.outcome !== 'tie' && streak.length >= 3;
        const betD7 = trueCount(d7, remaining) >= DRAGON7_COUNT.threshold;
        const betP8 = trueCount(p8, remaining) >= PANDA8_COUNT.threshold;
        const r = dealHand(shoe, DEFAULT_RULES, n, { withSteps: false });
        exp.hands++;
        if (betMain) exp.mainBets++;
        if (betD7) {
          exp.d7.bets++;
          if (r.dragon7) exp.d7.wins++;
        }
        if (betP8) {
          exp.p8.bets++;
          if (r.panda8) exp.p8.wins++;
        }
        if (betMain || betD7 || betP8) exp.handsBet++;
        for (const c of [...r.playerCards, ...r.bankerCards]) {
          const v = cardValue(c.rank);
          d7 += DRAGON7_COUNT.tags[v];
          p8 += PANDA8_COUNT.tags[v];
        }
        if (r.outcome === 'tie') {
          if (streak.outcome === null || streak.outcome === 'tie') streak = { outcome: 'tie', length: streak.length + 1 };
        } else {
          streak = streak.outcome === r.outcome ? { outcome: r.outcome, length: streak.length + 1 } : { outcome: r.outcome, length: 1 };
        }
        if (finalHand) break;
        if (r.cutCardDrawn) finalHand = true;
      }
    }
    expect(result.handsPlayed).toBe(exp.hands);
    expect(result.handsBet).toBe(exp.handsBet);
    expect(result.sideBets.dragon7).toMatchObject({ bets: exp.d7.bets, wins: exp.d7.wins, wagered: exp.d7.bets * 20 });
    expect(result.sideBets.panda8).toMatchObject({ bets: exp.p8.bets, wins: exp.p8.wins, wagered: exp.p8.bets * 20 });
    expect(result.sideBets.panda8.net).toBe(exp.p8.wins * 20 * 25 - (exp.p8.bets - exp.p8.wins) * 20);
    expect(result.totalWagered).toBe(exp.mainBets * 10 + (exp.d7.bets + exp.p8.bets) * 20);
    expect(exp.p8.bets).toBeGreaterThan(0);
    expect(exp.mainBets).toBeGreaterThan(exp.hands * 0.1);
    expect(exp.mainBets).toBeLessThan(exp.hands * 0.5);
  });

  it('runs on a six-deck table', () => {
    const rules = cloneRules(DEFAULT_RULES);
    rules.decks = 6;
    const r = runSimulation(config({ trials: 4, shoesPerTrial: 2, rules }));
    expect(r.handsPlayed).toBeGreaterThan(4 * 2 * 50);
    expect(r.handsPlayed).toBeLessThan(4 * 2 * 75);
    expect(r.handsBet).toBe(r.handsPlayed);
  });
});

describe('buildHistogram in whole cents', () => {
  it('never drops a value when the finals differ by cents (regression: float noise produced bins[-1])', () => {
    const cases: [number[], number][] = [
      [[718.18, 718.19], 5],
      [[3137.75, 3137.76, 3137.68], 10],
      [[685.1, 685.17, 685.05, 685.15, 685.18, 685.22, 685.2], 24],
      [[58.55, 58.52, 58.48, 58.48], 5],
      [[-0.01, 0.01, 0.02], 10],
    ];
    for (const [values, bins] of cases) {
      const h = buildHistogram(values, bins);
      expect(h.reduce((n, b) => n + b.count, 0)).toBe(values.length);
      expect(h[0].binStart).toBeLessThanOrEqual(Math.min(...values));
      expect(h[h.length - 1].binEnd).toBeGreaterThan(Math.max(...values));
    }
  });

  it('puts every value in the bin whose edges contain it, with contiguous equal whole-cent bins', () => {
    const rng = createRng(2024);
    for (let k = 0; k < 2000; k++) {
      const n = 1 + rng.nextInt(40);
      const scale = [0.05, 0.5, 5, 50, 500, 5000][rng.nextInt(6)];
      const base = roundCents((rng.next() - 0.3) * 20000);
      const values = Array.from({ length: n }, () => roundCents(base + (rng.next() - 0.5) * scale));
      const bins = buildHistogram(values, [1, 5, 10, 24][rng.nextInt(4)]);
      expect(bins.reduce((t, b) => t + b.count, 0)).toBe(n);
      const widthCents = Math.round((bins[0].binEnd - bins[0].binStart) * 100);
      if (bins.length > 1) expect(widthCents).toBeGreaterThanOrEqual(1);
      for (let i = 0; i < bins.length; i++) {
        const b = bins[i];
        if (i > 0) expect(b.binStart).toBe(bins[i - 1].binEnd);
        expect(Math.abs(b.binStart * 100 - Math.round(b.binStart * 100))).toBeLessThan(1e-6);
        expect(Math.round((b.binEnd - b.binStart) * 100)).toBe(widthCents);
        const last = i === bins.length - 1;
        const inside = values.filter((v) => v >= b.binStart && (last ? v <= b.binEnd : v < b.binEnd)).length;
        expect(b.count).toBe(inside);
      }
    }
  });
});
