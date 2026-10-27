import { describe, expect, it } from 'vitest';
import { BET_TYPES, DEFAULT_RULES, RULE_PRESETS, expectedValuePerUnit, houseEdge, outcomeProbabilities } from '@/engine';
import { betDistribution, betMean, betStdDev, betVariance, fairOdds, handsPerHit, martingaleStats, probAtLeastOne, sessionExpectation } from './math';

const PRESETS = [RULE_PRESETS.ez.rules, RULE_PRESETS.commission.rules, RULE_PRESETS.super6.rules];

describe('bet distributions', () => {
  it('sum to 1 and have the engine’s expected value for every bet and Banker rule', () => {
    for (const rules of PRESETS) {
      for (const bet of BET_TYPES) {
        const dist = betDistribution(bet, rules);
        expect(dist.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 12);
        expect(betMean(bet, rules)).toBeCloseTo(expectedValuePerUnit(bet, rules), 12);
        expect(-betMean(bet, rules)).toBeCloseTo(houseEdge(bet, rules), 12);
      }
    }
  });

  it('EZ Banker pushes on ties and Dragon 7s; Super 6 pays half on a Banker 6', () => {
    const ez = betDistribution('banker', RULE_PRESETS.ez.rules);
    const p = outcomeProbabilities('banker', RULE_PRESETS.ez.rules);
    expect(ez.find((o) => o.value === 0)?.p).toBeCloseTo(p.push, 12);
    const s6 = betDistribution('banker', RULE_PRESETS.super6.rules);
    expect(s6.some((o) => o.value === 0.5)).toBe(true);
    const c = betDistribution('banker', RULE_PRESETS.commission.rules);
    expect(c.find((o) => o.p === outcomeProbabilities('banker', RULE_PRESETS.commission.rules).win)?.value).toBeCloseTo(0.95, 12);
  });

  it('standard deviation per unit is about 0.94 for Banker and larger for long-shot bets', () => {
    expect(betStdDev('banker', DEFAULT_RULES)).toBeGreaterThan(0.9);
    expect(betStdDev('banker', DEFAULT_RULES)).toBeLessThan(0.96);
    expect(betStdDev('dragon7', DEFAULT_RULES)).toBeGreaterThan(5);
    expect(betVariance('tie', DEFAULT_RULES)).toBeGreaterThan(betVariance('player', DEFAULT_RULES));
  });
});

describe('sessionExpectation', () => {
  it('scales the expected loss with hands and the swing with the square root of hands', () => {
    const one = sessionExpectation('banker', 25, 100, DEFAULT_RULES);
    const four = sessionExpectation('banker', 25, 400, DEFAULT_RULES);
    expect(one.wagered).toBe(2500);
    expect(one.expectedNet).toBeCloseTo(-2500 * houseEdge('banker', DEFAULT_RULES), 9);
    expect(four.expectedNet).toBeCloseTo(4 * one.expectedNet, 9);
    expect(four.stdDev).toBeCloseTo(2 * one.stdDev, 9);
    expect(one.edge).toBeCloseTo(houseEdge('banker', DEFAULT_RULES), 12);
  });
  it('is zero for zero hands or amounts', () => {
    expect(Math.abs(sessionExpectation('player', 10, 0, DEFAULT_RULES).expectedNet)).toBe(0);
    expect(sessionExpectation('player', 0, 50, DEFAULT_RULES).stdDev).toBe(0);
  });
});

describe('small helpers', () => {
  it('probAtLeastOne, handsPerHit, fairOdds', () => {
    expect(probAtLeastOne(0.5, 2)).toBeCloseTo(0.75, 12);
    expect(probAtLeastOne(0.1, 0)).toBe(0);
    expect(handsPerHit(0.025)).toBeCloseTo(40, 12);
    expect(handsPerHit(0)).toBe(Infinity);
    expect(fairOdds(0.2)).toBeCloseTo(4, 12);
    // Dragon 7 at its exact probability is a 43.4:1 shot; 40:1 is short of fair.
    expect(fairOdds(0.022533820860379795)).toBeGreaterThan(43);
    expect(fairOdds(0.022533820860379795)).toBeLessThan(44);
  });
});

describe('martingaleStats', () => {
  it('counts the doublings a $10–$5,000 table allows and prices the bust', () => {
    const p = outcomeProbabilities('player', DEFAULT_RULES);
    const m = martingaleStats(10, 5000, p.win, p.lose);
    expect(m.sequence).toEqual([10, 20, 40, 80, 160, 320, 640, 1280, 2560]);
    expect(m.steps).toBe(9);
    expect(m.bustLoss).toBe(5110);
    const q = p.lose / (p.win + p.lose);
    expect(m.loseProb).toBeCloseTo(q, 12);
    expect(m.bustProb).toBeCloseTo(Math.pow(q, 9), 12);
    expect(m.sequencesPerBust).toBeCloseTo(1 / Math.pow(q, 9), 6);
    expect(m.expectedPerSequence).toBeLessThan(0);
    // The expected loss per sequence equals the house edge times the expected action of a sequence.
    const expectedAction = m.sequence.reduce((sum, bet, i) => sum + bet * Math.pow(q, i), 0);
    expect(m.expectedPerSequence).toBeCloseTo(-houseEdge('player', DEFAULT_RULES) * expectedAction / (p.win + p.lose), 6);
  });
  it('handles a unit above the maximum', () => {
    const m = martingaleStats(100, 50, 0.45, 0.45);
    expect(m.steps).toBe(0);
    expect(m.bustProb).toBe(1);
  });
});
