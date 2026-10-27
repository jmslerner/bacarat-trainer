import { describe, expect, it } from 'vitest';
import { bigRoad } from './bigRoad';
import { mulberry32, randomResults, seq } from './testHelpers';

const positions = (results: Parameters<typeof bigRoad>[0], rows?: number) =>
  bigRoad(results, rows).cells.map((c) => [c.col, c.row]);

describe('bigRoad', () => {
  it('is empty for an empty shoe', () => {
    expect(bigRoad([])).toEqual({ cells: [], columns: [], leadingTies: 0, width: 0, rows: 6 });
  });

  it('continues the same outcome down and starts a new column on a change', () => {
    // P P B P → column 1 = P(2) at col 1, column 2 = B(1) at col 2, column 3 = P(1) at col 3
    const road = bigRoad(seq('PPBP'));
    expect(road.cells.map((c) => [c.col, c.row, c.outcome])).toEqual([
      [1, 1, 'player'],
      [1, 2, 'player'],
      [2, 1, 'banker'],
      [3, 1, 'player'],
    ]);
    expect(road.cells.map((c) => [c.logicalCol, c.logicalRow])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
      [3, 1],
    ]);
    expect(road.columns).toEqual([
      { outcome: 'player', length: 2, startCol: 1 },
      { outcome: 'banker', length: 1, startCol: 2 },
      { outcome: 'player', length: 1, startCol: 3 },
    ]);
    expect(road.width).toBe(3);
    expect(road.cells.map((c) => c.handIndex)).toEqual([0, 1, 2, 3]);
  });

  it('records ties as marks on the most recent cell, never as cells', () => {
    const road = bigRoad(seq('P T T P B T'));
    expect(road.cells).toHaveLength(3);
    expect(road.cells.map((c) => c.ties)).toEqual([2, 0, 1]);
    expect(road.cells.map((c) => c.handIndex)).toEqual([0, 3, 4]);
    expect(road.columns).toEqual([
      { outcome: 'player', length: 2, startCol: 1 },
      { outcome: 'banker', length: 1, startCol: 2 },
    ]);
    expect(road.leadingTies).toBe(0);
  });

  it('counts ties before the first Player/Banker result as leadingTies', () => {
    const road = bigRoad(seq('T T P T'));
    expect(road.leadingTies).toBe(2);
    expect(road.cells).toHaveLength(1);
    expect(road.cells[0]).toMatchObject({ col: 1, row: 1, outcome: 'player', ties: 1, handIndex: 2 });
  });

  it('handles a shoe with only ties', () => {
    const road = bigRoad(seq('TTT'));
    expect(road).toMatchObject({ cells: [], columns: [], leadingTies: 3, width: 0 });
  });

  it('carries pair flags on the cells', () => {
    const road = bigRoad([
      { outcome: 'banker', bankerPair: true },
      { outcome: 'player', playerPair: true },
    ]);
    expect(road.cells[0]).toMatchObject({ playerPair: false, bankerPair: true });
    expect(road.cells[1]).toMatchObject({ playerPair: true, bankerPair: false });
  });

  it('turns right at the bottom of the grid (dragon tail)', () => {
    // 8 Players on 6 rows: (1,1)…(1,6) then right along row 6: (2,6), (3,6)
    const road = bigRoad(seq('PPPPPPPP'));
    expect(road.cells.map((c) => [c.col, c.row])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [1, 6],
      [2, 6],
      [3, 6],
    ]);
    expect(road.cells.map((c) => c.logicalRow)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(road.columns).toEqual([{ outcome: 'player', length: 8, startCol: 1 }]);
    expect(road.width).toBe(3);
  });

  it('respects a custom row count for the tail', () => {
    expect(positions(seq('PPPPP'), 3)).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('starts the next column right of the previous column start, above a tail', () => {
    // P×8 → tail on row 6 (cols 2, 3). B×7: (2,1)…(2,5); (2,6) is occupied by the tail → right along row 5.
    const road = bigRoad(seq('PPPPPPPP BBBBBBB'));
    expect(road.cells.slice(8).map((c) => [c.col, c.row])).toEqual([
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 5],
      [4, 5],
    ]);
    expect(road.columns[1]).toEqual({ outcome: 'banker', length: 7, startCol: 2 });
    expect(road.width).toBe(4);
    // the following Player starts at col 3 (= startCol 2 + 1), row 1, which is free
    const next = bigRoad(seq('PPPPPPPP BBBBBBB P'));
    expect(next.cells.at(-1)).toMatchObject({ col: 3, row: 1, logicalCol: 3, logicalRow: 1 });
    expect(next.columns[2]).toEqual({ outcome: 'player', length: 1, startCol: 3 });
  });

  it('keeps going right once a tail has turned, and skips occupied start cells', () => {
    // Derivation (rows = 6):
    //  P×8  (1,1)(1,2)(1,3)(1,4)(1,5)(1,6) → bottom → (2,6)(3,6)          column 1: P, 8, start 1
    //  B×6  start 2: (2,1)(2,2)(2,3)(2,4)(2,5); (2,6) occupied → (3,5)      column 2: B, 6, start 2
    //  P×5  start 3: (3,1)(3,2)(3,3)(3,4); (3,5) occupied → (4,4)           column 3: P, 5, start 3
    //  B×4  start 4: (4,1)(4,2)(4,3); (4,4) occupied → (5,3)                column 4: B, 4, start 4
    //  P×3  start 5: (5,1)(5,2); (5,3) occupied → (6,2)                     column 5: P, 3, start 5
    //  B×3  start 6: (6,1); (6,2) occupied → (7,1); keeps right → (8,1)      column 6: B, 3, start 6
    //       (note (7,2) is free, but a turned column never goes down again)
    //  P×1  start 7: (7,1) occupied, (8,1) occupied → (9,1)                  column 7: P, 1, start 9
    const road = bigRoad(seq('PPPPPPPP BBBBBB PPPPP BBBB PPP BBB P'));
    expect(road.cells.map((c) => [c.col, c.row])).toEqual([
      [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [3, 6],
      [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 5],
      [3, 1], [3, 2], [3, 3], [3, 4], [4, 4],
      [4, 1], [4, 2], [4, 3], [5, 3],
      [5, 1], [5, 2], [6, 2],
      [6, 1], [7, 1], [8, 1],
      [9, 1],
    ]);
    expect(road.columns).toEqual([
      { outcome: 'player', length: 8, startCol: 1 },
      { outcome: 'banker', length: 6, startCol: 2 },
      { outcome: 'player', length: 5, startCol: 3 },
      { outcome: 'banker', length: 4, startCol: 4 },
      { outcome: 'player', length: 3, startCol: 5 },
      { outcome: 'banker', length: 3, startCol: 6 },
      { outcome: 'player', length: 1, startCol: 9 },
    ]);
    expect(road.width).toBe(9);
  });

  it('never places two cells in the same physical cell (random shoes)', () => {
    const rng = mulberry32(7);
    for (let trial = 0; trial < 200; trial += 1) {
      const road = bigRoad(randomResults(rng, 120));
      const seen = new Set<string>();
      for (const cell of road.cells) {
        const key = `${cell.col},${cell.row}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        expect(cell.row).toBeGreaterThanOrEqual(1);
        expect(cell.row).toBeLessThanOrEqual(6);
        expect(cell.col).toBeGreaterThanOrEqual(1);
        expect(cell.col).toBeLessThanOrEqual(road.width);
      }
      // logical columns are consistent with the cells and strictly increase in startCol
      const total = road.columns.reduce((n, c) => n + c.length, 0);
      expect(total).toBe(road.cells.length);
      for (let i = 1; i < road.columns.length; i += 1) {
        expect(road.columns[i].startCol).toBeGreaterThan(road.columns[i - 1].startCol);
      }
    }
  });

  it('is prefix stable: cells never move when more results arrive', () => {
    const rng = mulberry32(99);
    for (let trial = 0; trial < 50; trial += 1) {
      const results = randomResults(rng, 90);
      const full = bigRoad(results);
      for (let n = 0; n <= results.length; n += 10) {
        const prefix = bigRoad(results.slice(0, n));
        expect(prefix.cells.map((c) => [c.col, c.row, c.outcome, c.handIndex])).toEqual(
          full.cells.slice(0, prefix.cells.length).map((c) => [c.col, c.row, c.outcome, c.handIndex]),
        );
      }
    }
  });

  it('rejects an invalid row count', () => {
    expect(() => bigRoad([], 0)).toThrow(RangeError);
  });
});
