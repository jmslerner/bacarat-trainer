import { describe, expect, it } from 'vitest';
import { bigRoad } from './bigRoad';
import { derivedEntries, derivedEntryAt, derivedRoad, predictNext } from './derived';
import { mulberry32, randomResults, seq } from './testHelpers';
import { DERIVED_KINDS, type RoadResult } from './types';

const entriesFor = (results: readonly RoadResult[], kind: 'bigEye' | 'small' | 'cockroach') =>
  derivedEntries(bigRoad(results).columns, kind);

describe('derivedEntries — hand-derived examples', () => {
  // Example 1: B B P P B P P P B
  // Logical columns: c1 = B(2), c2 = P(2), c3 = B(1), c4 = P(3), c5 = B(1)   → L = [2, 2, 1, 3, 1]
  //
  // Big eye boy (k = 1): r = 1 needs c >= 3, r >= 2 needs c >= 2
  //   (1,1) (1,2) (2,1): no entry
  //   (2,2): r=2 → column c-1 = 1, L[1] = 2 >= 2            → red
  //   (3,1): r=1 → L[2] = 2 vs L[1] = 2, equal               → red
  //   (4,1): r=1 → L[3] = 1 vs L[2] = 2, different           → blue
  //   (4,2): r=2 → column 3, L[3] = 1 === r-1 = 1            → blue
  //   (4,3): r=3 → column 3, L[3] = 1 <= r-2 = 1             → red
  //   (5,1): r=1 → L[4] = 3 vs L[3] = 1, different           → blue
  //   ⇒ [red, red, blue, blue, red, blue]
  //
  // Small road (k = 2): r = 1 needs c >= 4, r >= 2 needs c >= 3
  //   (4,1): r=1 → L[3] = 1 vs L[1] = 2, different           → blue
  //   (4,2): r=2 → column 2, L[2] = 2 >= 2                   → red
  //   (4,3): r=3 → column 2, L[2] = 2 === r-1 = 2            → blue
  //   (5,1): r=1 → L[4] = 3 vs L[2] = 2, different           → blue
  //   ⇒ [blue, red, blue, blue]
  //
  // Cockroach pig (k = 3): r = 1 needs c >= 5, r >= 2 needs c >= 4
  //   (4,2): r=2 → column 1, L[1] = 2 >= 2                   → red
  //   (4,3): r=3 → column 1, L[1] = 2 === r-1 = 2            → blue
  //   (5,1): r=1 → L[4] = 3 vs L[1] = 2, different           → blue
  //   ⇒ [red, blue, blue]
  const example1 = seq('B B P P B P P P B');

  it('example 1: big eye boy', () => {
    expect(entriesFor(example1, 'bigEye')).toEqual(['red', 'red', 'blue', 'blue', 'red', 'blue']);
  });

  it('example 1: small road', () => {
    expect(entriesFor(example1, 'small')).toEqual(['blue', 'red', 'blue', 'blue']);
  });

  it('example 1: cockroach pig', () => {
    expect(entriesFor(example1, 'cockroach')).toEqual(['red', 'blue', 'blue']);
  });

  // Example 2: B P B P P P P B B P B P
  // Logical columns: B(1) P(1) B(1) P(4) B(2) P(1) B(1) P(1)   → L = [1, 1, 1, 4, 2, 1, 1, 1]
  //
  // Big eye boy (k = 1):
  //   (3,1): L[2]=1 vs L[1]=1 equal            → red
  //   (4,1): L[3]=1 vs L[2]=1 equal            → red
  //   (4,2): column 3, L[3]=1 === r-1=1        → blue
  //   (4,3): column 3, L[3]=1 <= r-2=1         → red
  //   (4,4): column 3, L[3]=1 <= r-2=2         → red
  //   (5,1): L[4]=4 vs L[3]=1 different        → blue
  //   (5,2): column 4, L[4]=4 >= 2             → red
  //   (6,1): L[5]=2 vs L[4]=4 different        → blue
  //   (7,1): L[6]=1 vs L[5]=2 different        → blue
  //   (8,1): L[7]=1 vs L[6]=1 equal            → red
  //   ⇒ [red, red, blue, red, red, blue, red, blue, blue, red]
  //
  // Small road (k = 2):
  //   (4,1): L[3]=1 vs L[1]=1 equal            → red
  //   (4,2): column 2, L[2]=1 === 1            → blue
  //   (4,3): column 2, L[2]=1 <= 1             → red
  //   (4,4): column 2, L[2]=1 <= 2             → red
  //   (5,1): L[4]=4 vs L[2]=1 different        → blue
  //   (5,2): column 3, L[3]=1 === 1            → blue
  //   (6,1): L[5]=2 vs L[3]=1 different        → blue
  //   (7,1): L[6]=1 vs L[4]=4 different        → blue
  //   (8,1): L[7]=1 vs L[5]=2 different        → blue
  //   ⇒ [red, blue, red, red, blue, blue, blue, blue, blue]
  //
  // Cockroach pig (k = 3):
  //   (4,2): column 1, L[1]=1 === 1            → blue
  //   (4,3): column 1, L[1]=1 <= 1             → red
  //   (4,4): column 1, L[1]=1 <= 2             → red
  //   (5,1): L[4]=4 vs L[1]=1 different        → blue
  //   (5,2): column 2, L[2]=1 === 1            → blue
  //   (6,1): L[5]=2 vs L[2]=1 different        → blue
  //   (7,1): L[6]=1 vs L[3]=1 equal            → red
  //   (8,1): L[7]=1 vs L[4]=4 different        → blue
  //   ⇒ [blue, red, red, blue, blue, blue, red, blue]
  const example2 = seq('B P B P P P P B B P B P');

  it('example 2: big eye boy', () => {
    expect(entriesFor(example2, 'bigEye')).toEqual([
      'red', 'red', 'blue', 'red', 'red', 'blue', 'red', 'blue', 'blue', 'red',
    ]);
  });

  it('example 2: small road', () => {
    expect(entriesFor(example2, 'small')).toEqual([
      'red', 'blue', 'red', 'red', 'blue', 'blue', 'blue', 'blue', 'blue',
    ]);
  });

  it('example 2: cockroach pig', () => {
    expect(entriesFor(example2, 'cockroach')).toEqual(['blue', 'red', 'red', 'blue', 'blue', 'blue', 'red', 'blue']);
  });

  it('ignores ties: the same entries with ties sprinkled in', () => {
    const withTies = seq('T B T B P P T T B P P P B T');
    expect(entriesFor(withTies, 'bigEye')).toEqual(entriesFor(example1, 'bigEye'));
    expect(entriesFor(withTies, 'small')).toEqual(entriesFor(example1, 'small'));
    expect(entriesFor(withTies, 'cockroach')).toEqual(entriesFor(example1, 'cockroach'));
  });

  it('a perfect chop (P B P B …) is all red on every derived road', () => {
    const chop = seq('P B P B P B P B P B');
    // every column has length 1, so every comparison is "equal" → red
    expect(entriesFor(chop, 'bigEye')).toEqual(Array<'red'>(8).fill('red'));
    expect(entriesFor(chop, 'small')).toEqual(Array<'red'>(7).fill('red'));
    expect(entriesFor(chop, 'cockroach')).toEqual(Array<'red'>(6).fill('red'));
  });

  it('equal streaks (PPP BBB PPP) are all red on the big eye boy', () => {
    // (2,2): L[1]=3 >= 2 red; (2,3): 3 >= 3 red; (3,1): L[2]=3 vs L[1]=3 red; (3,2) red; (3,3) red
    expect(entriesFor(seq('PPP BBB PPP'), 'bigEye')).toEqual(['red', 'red', 'red', 'red', 'red']);
  });

  it('produces its first entry at big-road (2,2) or (3,1) / (3,2) or (4,1) / (4,2) or (5,1)', () => {
    // big eye boy (k=1)
    expect(entriesFor(seq('P B'), 'bigEye')).toEqual([]);
    expect(entriesFor(seq('P B B'), 'bigEye')).toHaveLength(1); // cell (2,2)
    expect(entriesFor(seq('P B P'), 'bigEye')).toHaveLength(1); // cell (3,1)
    // small road (k=2)
    expect(entriesFor(seq('P B P'), 'small')).toEqual([]);
    expect(entriesFor(seq('P B P P'), 'small')).toHaveLength(1); // cell (3,2)
    expect(entriesFor(seq('P B P B'), 'small')).toHaveLength(1); // cell (4,1)
    // cockroach pig (k=3)
    expect(entriesFor(seq('P B P B'), 'cockroach')).toEqual([]);
    expect(entriesFor(seq('P B P B B'), 'cockroach')).toHaveLength(1); // cell (4,2)
    expect(entriesFor(seq('P B P B P'), 'cockroach')).toHaveLength(1); // cell (5,1)
  });
});

describe('derivedEntryAt', () => {
  const L = [2, 2, 1, 3, 1];
  it('implements the three rules', () => {
    expect(derivedEntryAt(L, 1, 1, 1)).toBeNull();
    expect(derivedEntryAt(L, 2, 1, 1)).toBeNull();
    expect(derivedEntryAt(L, 3, 1, 1)).toBe('red'); // L[2] === L[1]
    expect(derivedEntryAt(L, 4, 1, 1)).toBe('blue'); // L[3] !== L[2]
    expect(derivedEntryAt(L, 1, 2, 1)).toBeNull(); // needs c >= 2
    expect(derivedEntryAt(L, 2, 2, 1)).toBe('red'); // L[1] = 2 >= 2
    expect(derivedEntryAt(L, 4, 2, 1)).toBe('blue'); // L[3] = 1 === r-1
    expect(derivedEntryAt(L, 4, 3, 1)).toBe('red'); // L[3] = 1 <= r-2
    expect(derivedEntryAt(L, 3, 1, 2)).toBeNull(); // small road new column needs c >= 4
    expect(derivedEntryAt(L, 4, 1, 3)).toBeNull(); // cockroach new column needs c >= 5
    expect(derivedEntryAt(L, 4, 2, 3)).toBe('red'); // column 1, L[1] = 2 >= 2
  });
});

describe('derivedRoad layout', () => {
  it('draws entries like the big road: same colour down, change starts a new column', () => {
    const road = derivedRoad(bigRoad(seq('B B P P B P P P B')), 'bigEye');
    // entries [red, red, blue, blue, red, blue]
    expect(road.entries).toEqual(['red', 'red', 'blue', 'blue', 'red', 'blue']);
    expect(road.cells.map((c) => [c.col, c.row, c.color, c.index])).toEqual([
      [1, 1, 'red', 0],
      [1, 2, 'red', 1],
      [2, 1, 'blue', 2],
      [2, 2, 'blue', 3],
      [3, 1, 'red', 4],
      [4, 1, 'blue', 5],
    ]);
    expect(road.width).toBe(4);
    expect(road.rows).toBe(6);
    expect(road.kind).toBe('bigEye');
  });

  it('uses the dragon-tail rule with the requested rows', () => {
    // P B then eight more P: columns P(1) B(1) P(8). Big eye boy: (3,1) red (1 vs 1), (3,2): column 2 has
    // L=1 === r-1 → blue, (3,3)…(3,8): L=1 <= r-2 → red ×6. Entries: red, blue, red×6.
    const road = derivedRoad(bigRoad(seq('P B P P P P P P P P')), 'bigEye', 3);
    expect(road.entries).toEqual(['red', 'blue', 'red', 'red', 'red', 'red', 'red', 'red']);
    expect(road.cells.map((c) => [c.col, c.row])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
      [3, 2],
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 3],
    ]);
    expect(road.width).toBe(6);
    expect(road.rows).toBe(3);
  });

  it('is empty when the big road is too short', () => {
    for (const kind of DERIVED_KINDS) {
      const road = derivedRoad(bigRoad(seq('P')), kind);
      expect(road).toEqual({ kind, entries: [], cells: [], width: 0, rows: 6 });
    }
  });
});

describe('predictNext', () => {
  it('returns null for every road when no entry would be produced', () => {
    expect(predictNext([], 'banker')).toEqual({ bigEye: null, small: null, cockroach: null });
    expect(predictNext(seq('B'), 'player')).toEqual({ bigEye: null, small: null, cockroach: null });
    expect(predictNext(seq('B'), 'banker')).toEqual({ bigEye: null, small: null, cockroach: null });
    expect(predictNext(seq('TT'), 'banker')).toEqual({ bigEye: null, small: null, cockroach: null });
  });

  it('predicts the first big eye boy entries', () => {
    // B P + B → new column 3: L[2] = 1 === L[1] = 1 → red; small/cockroach need more columns
    expect(predictNext(seq('B P'), 'banker')).toEqual({ bigEye: 'red', small: null, cockroach: null });
    // B P + P → cell (2,2): column 1, L[1] = 1 === r-1 → blue
    expect(predictNext(seq('B P'), 'player')).toEqual({ bigEye: 'blue', small: null, cockroach: null });
  });

  it('predicts both sides on example 1 (B B P P B P P P B, L = [2,2,1,3,1])', () => {
    // next Banker continues column 5 → cell (5,2):
    //   big eye: column 4, L=3 >= 2 → red; small: column 3, L=1 === 1 → blue; cockroach: column 2, L=2 >= 2 → red
    expect(predictNext(seq('B B P P B P P P B'), 'banker')).toEqual({ bigEye: 'red', small: 'blue', cockroach: 'red' });
    // next Player starts column 6 → cell (6,1):
    //   big eye: L[5]=1 vs L[4]=3 → blue; small: L[5]=1 vs L[3]=1 → red; cockroach: L[5]=1 vs L[2]=2 → blue
    expect(predictNext(seq('B B P P B P P P B'), 'player')).toEqual({ bigEye: 'blue', small: 'red', cockroach: 'blue' });
  });

  it('ignores trailing ties', () => {
    expect(predictNext(seq('B B P P B P P P B T T'), 'banker')).toEqual(predictNext(seq('B B P P B P P P B'), 'banker'));
  });

  it('matches the entry actually produced when that result is appended (random shoes)', () => {
    const rng = mulberry32(2024);
    for (let trial = 0; trial < 60; trial += 1) {
      const results = randomResults(rng, 70);
      for (let n = 0; n < results.length; n += 1) {
        const prefix = results.slice(0, n);
        for (const next of ['player', 'banker'] as const) {
          const predicted = predictNext(prefix, next);
          const before = bigRoad(prefix).columns;
          const after = bigRoad([...prefix, { outcome: next }]).columns;
          for (const kind of DERIVED_KINDS) {
            const was = derivedEntries(before, kind);
            const now = derivedEntries(after, kind);
            expect(now.length - was.length).toBeLessThanOrEqual(1);
            const actual = now.length > was.length ? now[now.length - 1] : null;
            expect(predicted[kind]).toBe(actual);
          }
        }
      }
    }
  });
});

describe('prefix stability', () => {
  it('derived entries of a truncated shoe are a prefix of the full shoe (all roads)', () => {
    const rng = mulberry32(31337);
    for (let trial = 0; trial < 80; trial += 1) {
      const results = randomResults(rng, 100);
      const fullColumns = bigRoad(results).columns;
      for (const kind of DERIVED_KINDS) {
        const full = derivedEntries(fullColumns, kind);
        for (let n = 0; n <= results.length; n += 7) {
          const part = derivedEntries(bigRoad(results.slice(0, n)).columns, kind);
          expect(full.slice(0, part.length)).toEqual(part);
        }
      }
    }
  });

  it('derived cells never move when more results arrive', () => {
    const rng = mulberry32(4242);
    for (let trial = 0; trial < 30; trial += 1) {
      const results = randomResults(rng, 100);
      const full = derivedRoad(bigRoad(results), 'small');
      for (let n = 0; n <= results.length; n += 10) {
        const part = derivedRoad(bigRoad(results.slice(0, n)), 'small');
        expect(full.cells.slice(0, part.cells.length)).toEqual(part.cells);
      }
    }
  });
});
