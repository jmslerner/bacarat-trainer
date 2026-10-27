import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, houseEdge } from '@/engine';
import { DRAGON7_COUNT, PANDA8_COUNT } from './counting';
import { betFrequency, pooledStats, recommendThreshold, returnPerHundredHands, simulateCountEv, toCountEvRows } from './countEv';
import type { CountEvBucket } from './countEv';
import { COUNT_EV_META, COUNT_EV_TABLE, countEvFrom } from './countEvTable';

const bucket = (tcMin: number, tcMax: number, hands: number, ev: number, stdErr: number): CountEvBucket => ({
  tcMin,
  tcMax,
  hands,
  frequency: hands / 1000,
  ev,
  wins: 0,
  stdErr,
});

describe('COUNT_EV_TABLE', () => {
  it('covers the whole true-count line contiguously for both bets', () => {
    for (const bet of ['dragon7', 'panda8'] as const) {
      const rows = COUNT_EV_TABLE[bet];
      expect(rows[0].tcMin).toBe(-Infinity);
      expect(rows[rows.length - 1].tcMax).toBe(Infinity);
      for (let i = 1; i < rows.length; i++) expect(rows[i].tcMin).toBe(rows[i - 1].tcMax);
      const hands = rows.reduce((n, r) => n + r.hands, 0);
      const frequency = rows.reduce((f, r) => f + r.frequency, 0);
      expect(hands).toBe(COUNT_EV_META.hands);
      expect(frequency).toBeCloseTo(1, 5);
      for (const r of rows) expect(r.frequency).toBeCloseTo(r.hands / COUNT_EV_META.hands, 6);
    }
    expect(COUNT_EV_META.shoes).toBeGreaterThanOrEqual(50000);
  });

  it('EV is negative below each threshold, positive from the threshold up, and rises with the count', () => {
    for (const [bet, system] of [['dragon7', DRAGON7_COUNT], ['panda8', PANDA8_COUNT]] as const) {
      const rows = COUNT_EV_TABLE[bet];
      expect(rows.some((r) => r.tcMin === system.threshold)).toBe(true);
      for (const r of rows) {
        if (r.tcMin >= system.threshold) expect(r.ev).toBeGreaterThan(0);
        else expect(r.ev).toBeLessThan(0);
      }
      for (let i = 1; i < rows.length; i++) expect(rows[i].ev).toBeGreaterThan(rows[i - 1].ev);
      expect(COUNT_EV_META.atThreshold[bet].threshold).toBe(system.threshold);
    }
  });

  it('the whole-table EV reproduces the exact house edge of the bet', () => {
    for (const bet of ['dragon7', 'panda8'] as const) {
      const overall = countEvFrom(bet, -Infinity);
      expect(overall.frequency).toBeCloseTo(1, 5);
      expect(overall.ev).toBeCloseTo(-houseEdge(bet, DEFAULT_RULES), 2);
    }
  });

  it('pooled numbers at the thresholds match the recorded meta', () => {
    for (const bet of ['dragon7', 'panda8'] as const) {
      const meta = COUNT_EV_META.atThreshold[bet];
      const pooled = countEvFrom(bet, meta.threshold);
      expect(pooled.frequency).toBeCloseTo(meta.frequency, 3);
      expect(pooled.ev).toBeCloseTo(meta.ev, 3);
      expect(pooled.unitsPer100Hands).toBeCloseTo(meta.unitsPer100Hands, 2);
      expect(meta.ev).toBeGreaterThan(2 * meta.stdErr);
    }
    expect(countEvFrom('dragon7', 4).ev).toBeGreaterThan(countEvFrom('dragon7', 2).ev);
  });
});

describe('simulateCountEv', () => {
  it('is deterministic and reproduces the embedded table within statistical tolerance', () => {
    const specs = [
      { key: 'dragon7', bet: 'dragon7' as const, tags: DRAGON7_COUNT.tags },
      { key: 'panda8', bet: 'panda8' as const, tags: PANDA8_COUNT.tags },
    ];
    const opts = { shoes: 8000, seed: 99, edges: [-2, 0, 2, 4, 6, 8, 10, 12] };
    const a = simulateCountEv(specs, opts);
    const b = simulateCountEv(specs, opts);
    expect(a).toEqual(b);
    expect(a[0].totalHands).toBeGreaterThan(4000 * 70);
    for (const stats of a) {
      const table = COUNT_EV_TABLE[stats.bet];
      expect(stats.rows.length).toBe(table.length);
      const hands = stats.rows.reduce((n, r) => n + r.hands, 0);
      expect(hands).toBe(stats.totalHands);
      // 8,000 shoes: bucket frequencies within 1% absolute (hands of one shoe share a count, so they are correlated),
      // overall EV within 3 standard errors of the exact edge.
      for (let i = 0; i < table.length; i++) {
        expect(stats.rows[i].tcMin).toBe(table[i].tcMin);
        expect(stats.rows[i].tcMax).toBe(table[i].tcMax);
        expect(Math.abs(stats.rows[i].frequency - table[i].frequency)).toBeLessThan(0.01);
      }
      expect(Math.abs(stats.overallEv + houseEdge(stats.bet, DEFAULT_RULES))).toBeLessThan(0.025);
      // The pooled EV at the threshold on these fresh cards agrees with the 500,000-shoe table within 3 standard errors.
      const meta = COUNT_EV_META.atThreshold[stats.bet];
      const pooled = pooledStats(stats.rows, meta.threshold);
      expect(pooled.hands).toBeGreaterThan(stats.totalHands * meta.frequency * 0.8);
      expect(Math.abs(pooled.ev - meta.ev)).toBeLessThan(3 * pooled.stdErr);
      expect(pooled.ev + 3 * pooled.stdErr).toBeGreaterThan(0);
    }
    expect(toCountEvRows(a[0].rows)[0]).toEqual({ tcMin: -Infinity, tcMax: -2, hands: a[0].rows[0].hands, frequency: a[0].rows[0].frequency, ev: a[0].rows[0].ev });
  });

  it('reports progress and validates its options', () => {
    const calls: number[] = [];
    simulateCountEv([{ key: 'd', bet: 'dragon7', tags: DRAGON7_COUNT.tags }], { shoes: 10, seed: 1, onProgress: (done) => calls.push(done) });
    expect(calls[calls.length - 1]).toBe(10);
    expect(() => simulateCountEv([], { shoes: 0, seed: 1 })).toThrow(RangeError);
    expect(() => simulateCountEv([], { shoes: 1, seed: 1, edges: [2, 1] })).toThrow(RangeError);
    expect(() => simulateCountEv([{ key: 'x', bet: 'dragon7', tags: [1, 2] }], { shoes: 1, seed: 1 })).toThrow(RangeError);
  });

  it('threshold helpers: pooled stats, return per 100 hands and the recommended threshold', () => {
    const rows = [
      bucket(-Infinity, 0, 600, -0.1, 0.01),
      bucket(0, 2, 200, -0.02, 0.01),
      bucket(2, 4, 100, 0.01, 0.02), // positive but not clearly (0.5σ)
      bucket(4, 6, 60, 0.05, 0.01),
      bucket(6, Infinity, 40, 0.1, 0.02),
    ];
    expect(betFrequency(rows, 4)).toBeCloseTo(0.1, 10);
    expect(returnPerHundredHands(rows, 4)).toBeCloseTo((0.06 * 0.05 + 0.04 * 0.1) * 100, 10);
    const pooled = pooledStats(rows, 4);
    expect(pooled.hands).toBe(100);
    expect(pooled.ev).toBeCloseTo(0.07, 10);
    expect(pooled.stdErr).toBeCloseTo(Math.sqrt(60 * 60 * 0.01 * 0.01 + 40 * 40 * 0.02 * 0.02) / 100, 10);
    // From 2 the return is higher (0.01 more per unit on 10% of hands) and the pooled EV is still > 2σ.
    expect(recommendThreshold(rows)).toBe(2);
    expect(recommendThreshold(rows, 1000)).toBeNull();
    const hopeless = [bucket(-Infinity, 0, 500, -0.1, 0.01), bucket(0, Infinity, 500, -0.01, 0.01)];
    expect(recommendThreshold(hopeless)).toBeNull();
  });
});
