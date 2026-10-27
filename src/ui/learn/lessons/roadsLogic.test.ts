import { describe, expect, it } from 'vitest';
import { DERIVED_KINDS, bigRoad, derivedEntries, derivedRoad, type RoadResult } from '@/roads';
import { ROAD_EXAMPLES, deriveWithReasons, seq } from './roadsLogic';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randomResults(seed: number, n: number): RoadResult[] {
  const rnd = lcg(seed);
  return Array.from({ length: n }, () => {
    const r = rnd();
    return { outcome: r < 0.095 ? 'tie' : r < 0.55 ? 'banker' : 'player' };
  });
}

describe('seq', () => {
  it('parses letters in any case with any separators', () => {
    expect(seq('P B,b t').map((r) => r.outcome)).toEqual(['player', 'banker', 'banker', 'tie']);
    expect(seq('')).toEqual([]);
    expect(() => seq('P X')).toThrow(RangeError);
  });
});

describe('deriveWithReasons', () => {
  it('matches derivedEntries from @/roads on the lesson examples, for all three roads', () => {
    for (const sequence of Object.values(ROAD_EXAMPLES)) {
      const results = seq(sequence);
      const columns = bigRoad(results).columns;
      for (const kind of DERIVED_KINDS) {
        const steps = deriveWithReasons(results, kind);
        expect(steps.map((s) => s.color)).toEqual(derivedEntries(columns, kind));
        expect(steps.map((s) => s.index)).toEqual(steps.map((_, i) => i));
        expect(deriveWithReasons(results, kind, 3)).toEqual(steps.slice(0, 3));
      }
    }
  });

  it('matches derivedEntries on random shoes', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const results = randomResults(seed, 90);
      const columns = bigRoad(results).columns;
      for (const kind of DERIVED_KINDS) {
        expect(deriveWithReasons(results, kind).map((s) => s.color)).toEqual(derivedEntries(columns, kind));
        expect(deriveWithReasons(results, kind).map((s) => s.color)).toEqual(derivedRoad(bigRoad(results), kind).entries);
      }
    }
  });

  it('spells out the big eye boy of the derived example as the lesson claims', () => {
    const results = seq(ROAD_EXAMPLES.derived);
    expect(bigRoad(results).columns.map((c) => c.length)).toEqual([2, 2, 1, 3, 1, 1, 2, 2, 4]);
    const steps = deriveWithReasons(results, 'bigEye', 6);
    expect(steps.map((s) => s.color)).toEqual(['red', 'red', 'blue', 'blue', 'red', 'blue']);
    expect(steps[0]).toMatchObject({ col: 2, row: 2, handIndex: 3 });
    expect(steps[0].reason).toMatch(/column 1 is at least 2 deep \(2\), so red/);
    expect(steps[1]).toMatchObject({ col: 3, row: 1, handIndex: 4 });
    expect(steps[1].reason).toMatch(/same depth, so red/);
    expect(steps[2].reason).toMatch(/different depths, so blue/);
    expect(steps[3].reason).toMatch(/stopped at exactly 1, so blue/);
    expect(steps[4].reason).toMatch(/short by two or more, so red/);
  });

  it('the lesson’s tie and dragon-tail examples show what they claim', () => {
    const ties = bigRoad(seq(ROAD_EXAMPLES.ties));
    expect(ties.leadingTies).toBe(1);
    expect(ties.cells.some((c) => c.ties === 2)).toBe(true);
    const tail = bigRoad(seq(ROAD_EXAMPLES.tail));
    expect(tail.columns.map((c) => c.length)).toEqual([8, 2, 1]);
    expect(tail.cells.filter((c) => c.logicalCol === 1).some((c) => c.row === 6 && c.col > 1)).toBe(true);
    const intro = bigRoad(seq(ROAD_EXAMPLES.intro));
    expect(intro.columns.map((c) => c.length)).toEqual([2, 1, 3, 2, 1]);
    expect(intro.cells[5].ties).toBe(1);
  });
});
