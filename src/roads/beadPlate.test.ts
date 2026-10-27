import { describe, expect, it } from 'vitest';
import { beadPlate } from './beadPlate';
import { seq } from './testHelpers';

describe('beadPlate', () => {
  it('returns no cells for an empty shoe', () => {
    expect(beadPlate([])).toEqual([]);
  });

  it('fills a 6-row grid column by column, top to bottom (1-based coordinates)', () => {
    const cells = beadPlate(seq('PBTPPBB'));
    expect(cells.map((c) => [c.col, c.row])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [1, 6],
      [2, 1],
    ]);
    expect(cells.map((c) => c.outcome)).toEqual(['player', 'banker', 'tie', 'player', 'player', 'banker', 'banker']);
    expect(cells.map((c) => c.handIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('honours a custom row count', () => {
    const cells = beadPlate(seq('PPPPP'), 3);
    expect(cells.map((c) => [c.col, c.row])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
      [2, 2],
    ]);
  });

  it('carries pair, Dragon 7 and Panda 8 flags and defaults missing flags to false', () => {
    const cells = beadPlate([
      { outcome: 'banker', bankerPair: true, dragon7: true },
      { outcome: 'player', playerPair: true, panda8: true },
      { outcome: 'tie' },
    ]);
    expect(cells[0]).toMatchObject({ playerPair: false, bankerPair: true, dragon7: true, panda8: false });
    expect(cells[1]).toMatchObject({ playerPair: true, bankerPair: false, dragon7: false, panda8: true });
    expect(cells[2]).toMatchObject({ playerPair: false, bankerPair: false, dragon7: false, panda8: false });
  });

  it('rejects an invalid row count', () => {
    expect(() => beadPlate([], 0)).toThrow(RangeError);
    expect(() => beadPlate([], 2.5)).toThrow(RangeError);
  });
});
