import { describe, expect, it } from 'vitest';
import { DERIVED_KINDS, bigRoad, derivedEntries, derivedRoad, predictNext, type RoadResult } from '@/roads';
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

describe('the lesson examples, derived BY HAND from SPEC §5.2', () => {
  // ROAD_EXAMPLES.derived = 'B B P P B P P P B P B B P P B B B B'
  // Logical big-road columns: BB | PP | B | PPP | B | P | BB | PP | BBBB  →  L = [2, 2, 1, 3, 1, 1, 2, 2, 4].
  // Cells in deal order (col,row): (1,1)(1,2)(2,1)(2,2)(3,1)(4,1)(4,2)(4,3)(5,1)(6,1)(7,1)(7,2)(8,1)(8,2)(9,1)(9,2)(9,3)(9,4).
  // Rule: r = 1 needs c ≥ k+2 and compares L[c−1] with L[c−1−k] (red if equal); r ≥ 2 needs c ≥ k+1 and looks at
  // L[c−k]: red if ≥ r, blue if = r−1, red if ≤ r−2.
  const results = seq(ROAD_EXAMPLES.derived);

  it('big eye boy (k = 1)', () => {
    // (2,2) L1=2≥2 red | (3,1) L2=2=L1 red | (4,1) L3=1≠L2=2 blue | (4,2) L3=1=r−1 blue | (4,3) L3=1≤r−2 red
    // (5,1) L4=3≠L3=1 blue | (6,1) L5=1≠L4=3 blue | (7,1) L6=1=L5=1 red | (7,2) L6=1=r−1 blue | (8,1) L7=2≠L6=1 blue
    // (8,2) L7=2≥2 red | (9,1) L8=2=L7=2 red | (9,2) L8=2≥2 red | (9,3) L8=2=r−1 blue | (9,4) L8=2≤r−2 red
    expect(deriveWithReasons(results, 'bigEye').map((s) => s.color)).toEqual([
      'red', 'red', 'blue', 'blue', 'red', 'blue', 'blue', 'red', 'blue', 'blue', 'red', 'red', 'red', 'blue', 'red',
    ]);
  });

  it('small road (k = 2)', () => {
    // (4,1) L3=1≠L1=2 blue | (4,2) L2=2≥2 red | (4,3) L2=2=r−1 blue | (5,1) L4=3≠L2=2 blue | (6,1) L5=1=L3=1 red
    // (7,1) L6=1≠L4=3 blue | (7,2) L5=1=r−1 blue | (8,1) L7=2≠L5=1 blue | (8,2) L6=1=r−1 blue | (9,1) L8=2≠L6=1 blue
    // (9,2) L7=2≥2 red | (9,3) L7=2=r−1 blue | (9,4) L7=2≤r−2 red
    expect(deriveWithReasons(results, 'small').map((s) => s.color)).toEqual([
      'blue', 'red', 'blue', 'blue', 'red', 'blue', 'blue', 'blue', 'blue', 'blue', 'red', 'blue', 'red',
    ]);
    expect(deriveWithReasons(results, 'small')[0]).toMatchObject({ col: 4, row: 1, handIndex: 5 });
  });

  it('cockroach pig (k = 3)', () => {
    // (4,2) L1=2≥2 red | (4,3) L1=2=r−1 blue | (5,1) L4=3≠L1=2 blue | (6,1) L5=1≠L2=2 blue | (7,1) L6=1=L3=1 red
    // (7,2) L4=3≥2 red | (8,1) L7=2≠L4=3 blue | (8,2) L5=1=r−1 blue | (9,1) L8=2≠L5=1 blue | (9,2) L6=1=r−1 blue
    // (9,3) L6=1≤r−2 red | (9,4) L6=1≤r−2 red
    expect(deriveWithReasons(results, 'cockroach').map((s) => s.color)).toEqual([
      'red', 'blue', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'red', 'red',
    ]);
    expect(deriveWithReasons(results, 'cockroach')[0]).toMatchObject({ col: 4, row: 2, handIndex: 6 });
  });

  it('"Ask the road" on the derived example: a Banker continues column 9 (all red), a Player opens column 10 (all blue)', () => {
    // Next B → (9,5): big eye L8=2≤3 red; small L7=2≤3 red; cockroach L6=1≤3 red.
    expect(predictNext(results, 'banker')).toEqual({ bigEye: 'red', small: 'red', cockroach: 'red' });
    // Next P → (10,1): big eye L9=4≠L8=2 blue; small L9=4≠L7=2 blue; cockroach L9=4≠L6=1 blue.
    expect(predictNext(results, 'player')).toEqual({ bigEye: 'blue', small: 'blue', cockroach: 'blue' });
  });

  it('the ties example is drawn as the lesson text describes it', () => {
    // 'T B B T P T T P B': hand 1 is a leading tie; hands 2–3 Banker (column 1); hand 4 ties onto the second Banker cell;
    // hand 5 Player opens column 2 and hands 6–7 are two ties on it; hand 8 Player; hand 9 Banker opens column 3.
    const road = bigRoad(seq(ROAD_EXAMPLES.ties));
    const byHand = (handIndex: number) => road.cells.find((c) => c.handIndex === handIndex);
    expect(road.leadingTies).toBe(1);
    expect(road.columns.map((c) => c.length)).toEqual([2, 2, 1]);
    expect(byHand(1)).toMatchObject({ col: 1, row: 1, outcome: 'banker', ties: 0 });
    expect(byHand(2)).toMatchObject({ col: 1, row: 2, outcome: 'banker', ties: 1 });
    expect(byHand(4)).toMatchObject({ col: 2, row: 1, outcome: 'player', ties: 2 });
    expect(byHand(7)).toMatchObject({ col: 2, row: 2, outcome: 'player', ties: 0 });
    expect(byHand(8)).toMatchObject({ col: 3, row: 1, outcome: 'banker' });
    expect(road.cells).toHaveLength(5);
  });
});
