/**
 * Independent review tests: two new 25+ hand sequences with ties and columns longer than the grid (dragon
 * tails), derived BY HAND from the SPEC §5.2 rules (derivations in the comments), plus the dragon-tail /
 * start-column rules at other grid heights and predictNext at several prefixes for both sides.
 */
import { describe, expect, it } from 'vitest';
import { bigRoad } from './bigRoad';
import { derivedEntries, derivedRoad, predictNext } from './derived';
import { roadStats } from './stats';
import { mulberry32, randomResults, seq } from './testHelpers';
import { DERIVED_KINDS } from './types';

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Sequence A (28 hands, 4 ties, a 7-long first column → dragon tail at the bottom)
//
//   hand: 1 2 3 4 5 6 7 8 | 9 10 11 12 | 13 | 14 15 16 17 18 | 19 20 21 | 22 23 24 | 25 | 26 27 | 28
//         P P T P P P P P | B B  T  B  | P  | B  B  B  B  T  | P  P  P  | B  T  B  | P  | B  B  | P
//
// Logical columns (ties ignored):  c1 P×7, c2 B×3, c3 P×1, c4 B×4, c5 P×3, c6 B×2, c7 P×1, c8 B×2, c9 P×1
//   L = [7, 3, 1, 4, 3, 2, 1, 2, 1]
// Ties: hand 3 marks the 2nd P of c1, hand 11 the 2nd B of c2, hand 18 the 4th B of c4, hand 23 the 1st B of c6.
//
// Big road (6 rows): c1 goes (1,1)…(1,6) then turns right → (2,6).  c2 starts at col 2 (= 1 + 1): (2,1)(2,2)(2,3).
//   c3 (3,1); c4 (4,1)…(4,4); c5 (5,1)…(5,3); c6 (6,1)(6,2); c7 (7,1); c8 (8,1)(8,2); c9 (9,1).  width 9.
//
// Big eye boy (k=1): r=1 needs c>=3 → red if L[c-1]==L[c-2]; r>=2 needs c>=2 → look at L[c-1]
//   (2,2) L1=7>=2 R   (2,3) 7>=3 R   (3,1) L2=3 vs L1=7 B   (4,1) L3=1 vs L2=3 B   (4,2) L3=1==1 B
//   (4,3) 1<=1 R      (4,4) 1<=2 R   (5,1) L4=4 vs L3=1 B   (5,2) L4=4>=2 R        (5,3) 4>=3 R
//   (6,1) L5=3 vs L4=4 B   (6,2) L5=3>=2 R   (7,1) L6=2 vs L5=3 B   (8,1) L7=1 vs L6=2 B
//   (8,2) L7=1==1 B   (9,1) L8=2 vs L7=1 B
//   ⇒ R R B B B R R B R R B R B B B B                                   (16 entries)
//
// Small road (k=2): r=1 needs c>=4 → L[c-1] vs L[c-3]; r>=2 needs c>=3 → look at L[c-2]
//   (4,1) L3=1 vs L1=7 B   (4,2) L2=3>=2 R   (4,3) 3>=3 R   (4,4) 3==3 B   (5,1) L4=4 vs L2=3 B
//   (5,2) L3=1==1 B        (5,3) 1<=1 R      (6,1) L5=3 vs L3=1 B   (6,2) L4=4>=2 R
//   (7,1) L6=2 vs L4=4 B   (8,1) L7=1 vs L5=3 B   (8,2) L6=2>=2 R   (9,1) L8=2 vs L6=2 R
//   ⇒ B R R B B B R B R B B R R                                         (13 entries)
//
// Cockroach pig (k=3): r=1 needs c>=5 → L[c-1] vs L[c-4]; r>=2 needs c>=4 → look at L[c-3]
//   (4,2) L1=7>=2 R   (4,3) R   (4,4) R   (5,1) L4=4 vs L1=7 B   (5,2) L2=3>=2 R   (5,3) 3>=3 R
//   (6,1) L5=3 vs L2=3 R   (6,2) L3=1==1 B   (7,1) L6=2 vs L3=1 B   (8,1) L7=1 vs L4=4 B
//   (8,2) L5=3>=2 R        (9,1) L8=2 vs L5=3 B
//   ⇒ R R R B R R R B B B R B                                           (12 entries)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
const A = 'P P T P P P P P  B B T B  P  B B B B T  P P P  B T B  P  B B  P';
const colorsA = {
  bigEye: 'R R B B B R R B R R B R B B B B',
  small: 'B R R B B B R B R B B R R',
  cockroach: 'R R R B R R R B B B R B',
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Sequence B (33 hands, 5 ties incl. 2 leading ties, two 8-long columns → a bottom tail AND a collision tail)
//
//   hand: 1 2 3 4 5 6 7 8 9 10 11 | 12 13 14 15 16 17 18 19 | 20 21 22 | 23 24 | 25 | 26 27 28 29 | 30 31 32 | 33
//         T T B B B B B B T B  B  | P  P  P  P  P  P  P  P  | B  T  B  | P  P  | B  | P  P  P  P  | B  B  T  | P
//
// Logical columns:  c1 B×8, c2 P×8, c3 B×2, c4 P×2, c5 B×1, c6 P×4, c7 B×2, c8 P×1
//   L = [8, 8, 2, 2, 1, 4, 2, 1];  leadingTies = 2
// Ties: hand 9 marks the 6th B of c1, hand 21 the 1st B of c3, hand 32 the 2nd B of c7.
//
// Big road (6 rows):
//   c1: (1,1)…(1,6), bottom → right along row 6: (2,6)(3,6)
//   c2: starts col 2: (2,1)…(2,5); (2,6) is occupied → right along row 5: (3,5)(4,5)(5,5)
//   c3: (3,1)(3,2)   c4: (4,1)(4,2)   c5: (5,1)   c6: (6,1)…(6,4)   c7: (7,1)(7,2)   c8: (8,1)     width 8
//
// Big eye boy (k=1):
//   (2,2)…(2,8): L1=8 >= r for r=2..8 → R×7      (3,1) L2=8 vs L1=8 R      (3,2) L2=8>=2 R
//   (4,1) L3=2 vs L2=8 B   (4,2) L3=2>=2 R   (5,1) L4=2 vs L3=2 R   (6,1) L5=1 vs L4=2 B
//   (6,2) L5=1==1 B   (6,3) 1<=1 R   (6,4) 1<=2 R   (7,1) L6=4 vs L5=1 B   (7,2) L6=4>=2 R   (8,1) L7=2 vs L6=4 B
//   ⇒ R R R R R R R R R B R R B B R R B R B                             (19 entries)
//
// Small road (k=2):
//   (3,2) L1=8>=2 R   (4,1) L3=2 vs L1=8 B   (4,2) L2=8>=2 R   (5,1) L4=2 vs L2=8 B   (6,1) L5=1 vs L3=2 B
//   (6,2) L4=2>=2 R   (6,3) L4=2==2 B   (6,4) 2<=2 R   (7,1) L6=4 vs L4=2 B   (7,2) L5=1==1 B   (8,1) L7=2 vs L5=1 B
//   ⇒ R B R B B R B R B B B                                             (11 entries)
//
// Cockroach pig (k=3):
//   (4,2) L1=8>=2 R   (5,1) L4=2 vs L1=8 B   (6,1) L5=1 vs L2=8 B   (6,2) L3=2>=2 R   (6,3) L3=2==2 B
//   (6,4) 2<=2 R      (7,1) L6=4 vs L3=2 B   (7,2) L4=2>=2 R        (8,1) L7=2 vs L4=2 R
//   ⇒ R B B R B R B R R                                                 (9 entries)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
const B = 'T T B B B B B B T B B  P P P P P P P P  B T B  P P  B  P P P P  B B T  P';
const colorsB = {
  bigEye: 'R R R R R R R R R B R R B B R R B R B',
  small: 'R B R B B R B R B B B',
  cockroach: 'R B B R B R B R R',
};

const colors = (spec: string) => spec.split(/\s+/).map((ch) => (ch === 'R' ? 'red' : 'blue'));
const positions = (cells: readonly { col: number; row: number }[]) => cells.map((c) => [c.col, c.row]);

describe('sequence A (hand-derived)', () => {
  const results = seq(A);
  const road = bigRoad(results);

  it('big road: logical columns, tie marks and the bottom dragon tail', () => {
    expect(road.columns).toEqual([
      { outcome: 'player', length: 7, startCol: 1 },
      { outcome: 'banker', length: 3, startCol: 2 },
      { outcome: 'player', length: 1, startCol: 3 },
      { outcome: 'banker', length: 4, startCol: 4 },
      { outcome: 'player', length: 3, startCol: 5 },
      { outcome: 'banker', length: 2, startCol: 6 },
      { outcome: 'player', length: 1, startCol: 7 },
      { outcome: 'banker', length: 2, startCol: 8 },
      { outcome: 'player', length: 1, startCol: 9 },
    ]);
    expect(positions(road.cells)).toEqual([
      [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6],
      [2, 1], [2, 2], [2, 3],
      [3, 1],
      [4, 1], [4, 2], [4, 3], [4, 4],
      [5, 1], [5, 2], [5, 3],
      [6, 1], [6, 2],
      [7, 1],
      [8, 1], [8, 2],
      [9, 1],
    ]);
    expect(road.width).toBe(9);
    expect(road.leadingTies).toBe(0);
    expect(road.cells.map((c) => c.handIndex)).toEqual([
      0, 1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 23, 24, 25, 26, 27,
    ]);
    const tied = road.cells.filter((c) => c.ties > 0).map((c) => [c.handIndex, c.ties]);
    expect(tied).toEqual([
      [1, 1],
      [9, 1],
      [16, 1],
      [21, 1],
    ]);
  });

  it('derived entries match the hand derivation', () => {
    for (const kind of DERIVED_KINDS) {
      expect(derivedEntries(road.columns, kind), kind).toEqual(colors(colorsA[kind]));
    }
  });

  it('big eye boy layout: R R | B B B | R R | B | R R | B | R | B B B B', () => {
    expect(positions(derivedRoad(road, 'bigEye').cells)).toEqual([
      [1, 1], [1, 2],
      [2, 1], [2, 2], [2, 3],
      [3, 1], [3, 2],
      [4, 1],
      [5, 1], [5, 2],
      [6, 1],
      [7, 1],
      [8, 1], [8, 2], [8, 3], [8, 4],
    ]);
  });

  it('predictNext for both sides at several prefixes', () => {
    // After hand 8 (only c1 = P×7): next P → (1,8), next B → (2,1): no road has an entry yet.
    expect(predictNext(results.slice(0, 8), 'player')).toEqual({ bigEye: null, small: null, cockroach: null });
    expect(predictNext(results.slice(0, 8), 'banker')).toEqual({ bigEye: null, small: null, cockroach: null });
    // After hand 12 (L = [7, 3]): next B → (2,4): big eye L1=7>=4 red; next P → (3,1): L2=3 vs L1=7 blue.
    expect(predictNext(results.slice(0, 12), 'banker')).toEqual({ bigEye: 'red', small: null, cockroach: null });
    expect(predictNext(results.slice(0, 12), 'player')).toEqual({ bigEye: 'blue', small: null, cockroach: null });
    // After hand 17 (L = [7, 3, 1, 4]) — and identically after the tie at hand 18:
    //   next B → (4,5): big eye L3=1<=3 red; small L2=3<=3 red; cockroach L1=7>=5 red
    //   next P → (5,1): big eye L4=4 vs L3=1 blue; small L4=4 vs L2=3 blue; cockroach L4=4 vs L1=7 blue
    for (const n of [17, 18]) {
      expect(predictNext(results.slice(0, n), 'banker')).toEqual({ bigEye: 'red', small: 'red', cockroach: 'red' });
      expect(predictNext(results.slice(0, n), 'player')).toEqual({ bigEye: 'blue', small: 'blue', cockroach: 'blue' });
    }
    // Full sequence (L = [7,3,1,4,3,2,1,2,1], last column P×1):
    //   next P → (9,2): big eye L8=2>=2 red; small L7=1==1 blue; cockroach L6=2>=2 red
    //   next B → (10,1): big eye L9=1 vs L8=2 blue; small L9=1 vs L7=1 red; cockroach L9=1 vs L6=2 blue
    expect(predictNext(results, 'player')).toEqual({ bigEye: 'red', small: 'blue', cockroach: 'red' });
    expect(predictNext(results, 'banker')).toEqual({ bigEye: 'blue', small: 'red', cockroach: 'blue' });
  });

  it('stats agree with the big road', () => {
    expect(roadStats(results)).toMatchObject({
      total: 28,
      player: 13,
      banker: 11,
      tie: 4,
      currentStreak: { outcome: 'player', length: 1 },
      longestPlayer: 7,
      longestBanker: 4,
    });
  });
});

describe('sequence B (hand-derived)', () => {
  const results = seq(B);
  const road = bigRoad(results);

  it('big road: leading ties, bottom tail and a collision tail on row 5', () => {
    expect(road.leadingTies).toBe(2);
    expect(road.columns).toEqual([
      { outcome: 'banker', length: 8, startCol: 1 },
      { outcome: 'player', length: 8, startCol: 2 },
      { outcome: 'banker', length: 2, startCol: 3 },
      { outcome: 'player', length: 2, startCol: 4 },
      { outcome: 'banker', length: 1, startCol: 5 },
      { outcome: 'player', length: 4, startCol: 6 },
      { outcome: 'banker', length: 2, startCol: 7 },
      { outcome: 'player', length: 1, startCol: 8 },
    ]);
    expect(positions(road.cells)).toEqual([
      [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [3, 6],
      [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 5], [4, 5], [5, 5],
      [3, 1], [3, 2],
      [4, 1], [4, 2],
      [5, 1],
      [6, 1], [6, 2], [6, 3], [6, 4],
      [7, 1], [7, 2],
      [8, 1],
    ]);
    expect(road.cells.map((c) => [c.logicalCol, c.logicalRow]).slice(8, 16)).toEqual([
      [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8],
    ]);
    expect(road.width).toBe(8);
    const tied = road.cells.filter((c) => c.ties > 0).map((c) => [c.handIndex, c.ties]);
    expect(tied).toEqual([
      [7, 1],
      [19, 1],
      [30, 1],
    ]);
  });

  it('derived entries match the hand derivation', () => {
    for (const kind of DERIVED_KINDS) {
      expect(derivedEntries(road.columns, kind), kind).toEqual(colors(colorsB[kind]));
    }
  });

  it('derived layouts: the nine-red big eye boy column tails along row 6', () => {
    expect(positions(derivedRoad(road, 'bigEye').cells)).toEqual([
      [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [3, 6], [4, 6],
      [2, 1],
      [3, 1], [3, 2],
      [4, 1], [4, 2],
      [5, 1], [5, 2],
      [6, 1],
      [7, 1],
      [8, 1],
    ]);
    expect(positions(derivedRoad(road, 'small').cells)).toEqual([
      [1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [8, 2], [8, 3],
    ]);
    expect(positions(derivedRoad(road, 'cockroach').cells)).toEqual([
      [1, 1], [2, 1], [2, 2], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [7, 2],
    ]);
  });

  it('the same big road on 4 rows: tails collide and displace later column starts', () => {
    // c1 B×8: (1,1)…(1,4) then right along row 4: (2,4)(3,4)(4,4)(5,4)
    // c2 P×8: starts col 2: (2,1)(2,2)(2,3); (2,4) occupied → right along row 3: (3,3)(4,3)(5,3)(6,3)(7,3)
    // c3 B×2: (3,1)(3,2)        c4 P×2: (4,1)(4,2)        c5 B×1: (5,1)
    // c6 P×4: (6,1)(6,2); (6,3) occupied → (7,2)(8,2)
    // c7 B×2: starts col 7: (7,1); (7,2) occupied → (8,1)
    // c8 P×1: starts col 8: (8,1) occupied → (9,1)                                              width 9
    const four = bigRoad(results, 4);
    expect(positions(four.cells)).toEqual([
      [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4],
      [2, 1], [2, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
      [3, 1], [3, 2],
      [4, 1], [4, 2],
      [5, 1],
      [6, 1], [6, 2], [7, 2], [8, 2],
      [7, 1], [8, 1],
      [9, 1],
    ]);
    expect(four.columns.map((c) => c.startCol)).toEqual([1, 2, 3, 4, 5, 6, 7, 9]);
    expect(four.width).toBe(9);
    expect(four.rows).toBe(4);
    // the logical columns (sides and lengths — startCol is physical) and therefore the derived roads do not
    // depend on the grid height
    const logical = (c: { outcome: string; length: number }) => [c.outcome, c.length];
    expect(four.columns.map(logical)).toEqual(road.columns.map(logical));
    for (const kind of DERIVED_KINDS) {
      expect(derivedEntries(four.columns, kind)).toEqual(colors(colorsB[kind]));
    }
  });

  it('predictNext for both sides at several prefixes', () => {
    // After hand 11 (L = [8] behind two leading ties): nothing yet.
    expect(predictNext(results.slice(0, 11), 'banker')).toEqual({ bigEye: null, small: null, cockroach: null });
    expect(predictNext(results.slice(0, 11), 'player')).toEqual({ bigEye: null, small: null, cockroach: null });
    // After hand 19 (L = [8, 8]): next P → (2,9): L1=8 == r-1 → blue; next B → (3,1): L2=8 vs L1=8 → red.
    expect(predictNext(results.slice(0, 19), 'player')).toEqual({ bigEye: 'blue', small: null, cockroach: null });
    expect(predictNext(results.slice(0, 19), 'banker')).toEqual({ bigEye: 'red', small: null, cockroach: null });
    // After hand 25 (L = [8, 8, 2, 2, 1]):
    //   next B → (5,2): big eye L4=2>=2 red; small L3=2>=2 red; cockroach L2=8>=2 red
    //   next P → (6,1): big eye L5=1 vs L4=2 blue; small L5=1 vs L3=2 blue; cockroach L5=1 vs L2=8 blue
    expect(predictNext(results.slice(0, 25), 'banker')).toEqual({ bigEye: 'red', small: 'red', cockroach: 'red' });
    expect(predictNext(results.slice(0, 25), 'player')).toEqual({ bigEye: 'blue', small: 'blue', cockroach: 'blue' });
    // Full sequence (L = [8,8,2,2,1,4,2,1], last column P×1):
    //   next P → (8,2): big eye L7=2>=2 red; small L6=4>=2 red; cockroach L5=1==1 blue
    //   next B → (9,1): big eye L8=1 vs L7=2 blue; small L8=1 vs L6=4 blue; cockroach L8=1 vs L5=1 red
    expect(predictNext(results, 'player')).toEqual({ bigEye: 'red', small: 'red', cockroach: 'blue' });
    expect(predictNext(results, 'banker')).toEqual({ bigEye: 'blue', small: 'blue', cockroach: 'red' });
  });

  it('stats: ties never break a column, leading ties are counted', () => {
    expect(roadStats(results)).toMatchObject({
      total: 33,
      player: 15,
      banker: 13,
      tie: 5,
      currentStreak: { outcome: 'player', length: 1 },
      longestPlayer: 8,
      longestBanker: 8,
    });
  });
});

describe('dragon tail and start-column rules', () => {
  it('a column blocked right under its first cell runs right along row 1', () => {
    // P×7 fills col 1 and tails to (2,6); B×6 → (2,1)…(2,5), (2,6) occupied → (3,5);
    // P×5 → (3,1)…(3,4), (3,5) occupied → (4,4); B×4 → (4,1)…(4,3), (4,4) occupied → (5,3);
    // P×3 → (5,1)(5,2), (5,3) occupied → (6,2); B×3 → (6,1), (6,2) occupied → (7,1)(8,1) along row 1.
    const road = bigRoad(seq('PPPPPPP BBBBBB PPPPP BBBB PPP BBB'));
    expect(positions(road.cells).slice(-3)).toEqual([
      [6, 1],
      [7, 1],
      [8, 1],
    ]);
    // the next column starts at startCol 6 + 1 = 7, which is taken, as is 8 → 9
    expect(bigRoad(seq('PPPPPPP BBBBBB PPPPP BBBB PPP BBB P')).cells.at(-1)).toMatchObject({ col: 9, row: 1 });
  });

  it('once turned, a tail never goes back down even when the cell below is free', () => {
    // rows = 2: P×4 → (1,1)(1,2), bottom → (2,2)(3,2). B×3 starts col 2: (2,1); (2,2) occupied → (3,1)(4,1):
    // (4,2) is free below (4,1) but the tail keeps going right.
    const road = bigRoad(seq('PPPP BBB B'), 2);
    expect(positions(road.cells)).toEqual([
      [1, 1], [1, 2], [2, 2], [3, 2],
      [2, 1], [3, 1], [4, 1], [5, 1],
    ]);
  });

  it('derived roads never place two entries in the same physical cell (random shoes)', () => {
    const rng = mulberry32(777);
    for (let trial = 0; trial < 100; trial += 1) {
      const big = bigRoad(randomResults(rng, 120));
      for (const kind of DERIVED_KINDS) {
        const road = derivedRoad(big, kind);
        const seen = new Set<string>();
        for (const cell of road.cells) {
          const key = `${cell.col},${cell.row}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
          expect(cell.row).toBeGreaterThanOrEqual(1);
          expect(cell.row).toBeLessThanOrEqual(road.rows);
          expect(cell.col).toBeLessThanOrEqual(road.width);
        }
        expect(road.cells.map((c) => c.color)).toEqual(road.entries);
        expect(road.cells.map((c) => c.index)).toEqual(road.entries.map((_, i) => i));
      }
    }
  });

  it('inputs are never mutated', () => {
    const results = seq(B);
    const snapshot = JSON.stringify(results);
    const big = bigRoad(results);
    const bigSnapshot = JSON.stringify(big);
    for (const kind of DERIVED_KINDS) derivedRoad(big, kind);
    predictNext(results, 'player');
    predictNext(results, 'banker');
    roadStats(results);
    expect(JSON.stringify(results)).toBe(snapshot);
    expect(JSON.stringify(big)).toBe(bigSnapshot);
  });
});
