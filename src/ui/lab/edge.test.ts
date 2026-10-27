import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, houseEdge } from '@/engine';
import { COUNT_EV_META } from '@/strategy';
import { edgeVerdict, expectedEdge, formatEdgeRange, isEdgeRange, mainEdgeRange, sideBetHouseEdge } from './edge';
import { fakeResult } from './testHelpers';

describe('mainEdgeRange', () => {
  it('is the exact edge for one-sided selectors and the Banker/Player span otherwise', () => {
    const banker = mainEdgeRange('alwaysBanker', DEFAULT_RULES);
    expect(banker.low).toBeCloseTo(0.010183, 5);
    expect(banker.high).toBe(banker.low);
    expect(banker.label).toBe('Banker');
    const player = mainEdgeRange('alwaysPlayer', DEFAULT_RULES);
    expect(player.low).toBeCloseTo(0.012351, 5);
    expect(player.label).toBe('Player');
    const mixed = mainEdgeRange('followLast', DEFAULT_RULES);
    expect(mixed.low).toBeCloseTo(0.010183, 5);
    expect(mixed.high).toBeCloseTo(0.012351, 5);
    expect(mixed.label).toBe('Banker / Player');
    expect(mainEdgeRange('alwaysBanker', { ...DEFAULT_RULES, bankerRule: 'commission' }).low).toBeCloseTo(0.010579, 5);
  });
});

describe('sideBetHouseEdge', () => {
  it('is null when the bet is never placed or not dealt, exact when always placed', () => {
    expect(sideBetHouseEdge('dragon7', 'never', DEFAULT_RULES)).toBeNull();
    expect(sideBetHouseEdge('dragon7', 'always', { ...DEFAULT_RULES, sideBets: { ...DEFAULT_RULES.sideBets, dragon7: false } })).toBeNull();
    expect(sideBetHouseEdge('dragon7', 'always', DEFAULT_RULES)).toBeCloseTo(houseEdge('dragon7', DEFAULT_RULES), 12);
    expect(sideBetHouseEdge('panda8', 'always', DEFAULT_RULES)).toBeCloseTo(0.101876, 5);
  });

  it('uses the simulated EV at the count threshold for the count policy, re-priced for custom payouts', () => {
    const d7 = sideBetHouseEdge('dragon7', 'count', DEFAULT_RULES);
    expect(d7).toBeCloseTo(-COUNT_EV_META.atThreshold.dragon7.ev, 12);
    expect(d7).toBeLessThan(0);
    const p8 = sideBetHouseEdge('panda8', 'count', DEFAULT_RULES);
    expect(p8).toBeCloseTo(-COUNT_EV_META.atThreshold.panda8.ev, 12);
    // A 50:1 Dragon 7 keeps the same hit rate on qualifying hands and pays more per hit.
    const hitRate = (COUNT_EV_META.atThreshold.dragon7.ev + 1) / 41;
    expect(sideBetHouseEdge('dragon7', 'count', { ...DEFAULT_RULES, dragon7Pays: 50 })).toBeCloseTo(-(hitRate * 51 - 1), 12);
  });
});

describe('expectedEdge', () => {
  it('blends the exact edges by the money wagered on each bet', () => {
    const result = fakeResult(
      { totalWagered: 1000, sideBets: { dragon7: { bets: 20, wins: 1, wagered: 200, net: -159 }, panda8: { bets: 0, wins: 0, wagered: 0, net: 0 } } },
      { strategy: { selectorId: 'alwaysBanker', systemId: 'flat', systemParams: {}, unit: 10, sideBets: { dragon7: 'always', panda8: 'never', units: 1 } } },
    );
    const e = expectedEdge(result);
    expect(e).not.toBeNull();
    const want = (800 * houseEdge('banker', DEFAULT_RULES) + 200 * houseEdge('dragon7', DEFAULT_RULES)) / 1000;
    expect(e?.low).toBeCloseTo(want, 10);
    expect(e?.high).toBeCloseTo(want, 10);
    expect(e?.dragon7).toBeCloseTo(houseEdge('dragon7', DEFAULT_RULES), 10);
    expect(e?.panda8).toBeNull();
    expect(e?.simulated).toBe(false);
    expect(isEdgeRange(e as NonNullable<typeof e>)).toBe(false);
  });

  it('is a range for two-sided selectors, flags count policies as simulated and is null without wagers', () => {
    const mixed = expectedEdge(fakeResult({}, { strategy: { selectorId: 'betAgainstLast', systemId: 'flat', systemParams: {}, unit: 10, sideBets: { dragon7: 'never', panda8: 'never', units: 1 } } }));
    expect(mixed && isEdgeRange(mixed)).toBe(true);
    expect(mixed?.main.label).toBe('Banker / Player');
    const counted = expectedEdge(
      fakeResult(
        { totalWagered: 1000, sideBets: { dragon7: { bets: 10, wins: 1, wagered: 500, net: 100 }, panda8: { bets: 0, wins: 0, wagered: 0, net: 0 } } },
        { strategy: { selectorId: 'alwaysBanker', systemId: 'flat', systemParams: {}, unit: 10, sideBets: { dragon7: 'count', panda8: 'never', units: 5 } } },
      ),
    );
    expect(counted?.simulated).toBe(true);
    expect(counted?.high).toBeLessThan(0); // half the money on a +7.7% bet beats the 1.02% Banker edge
    expect(expectedEdge(fakeResult({ totalWagered: 0 }))).toBeNull();
  });
});

describe('formatting and verdicts', () => {
  it('formats single figures and ranges', () => {
    expect(formatEdgeRange({ low: 0.010183, high: 0.010183 })).toBe('1.02%');
    expect(formatEdgeRange({ low: 0.010183, high: 0.012351 })).toBe('1.02–1.24%');
    expect(formatEdgeRange({ low: -0.0771, high: -0.0771 })).toBe('-7.71%');
    expect(formatEdgeRange({ low: -0.0035, high: 0.0102 })).toBe('-0.35% to 1.02%');
    expect(formatEdgeRange({ low: -0.02, high: -0.01 })).toBe('-2.00–-1.00%');
  });

  it('calls a run in line, luckier or unluckier with a tolerance for noise', () => {
    const banker = { low: 0.010183, high: 0.010183 };
    expect(edgeVerdict(0.0105, banker)).toBe('inLine');
    expect(edgeVerdict(0.012, banker)).toBe('inLine');
    expect(edgeVerdict(0.02, banker)).toBe('unluckier');
    expect(edgeVerdict(-0.01, banker)).toBe('luckier');
    expect(edgeVerdict(0.0115, { low: 0.010183, high: 0.012351 })).toBe('inLine');
  });
});
