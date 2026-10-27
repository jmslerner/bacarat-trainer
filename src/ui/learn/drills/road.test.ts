import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine';
import type { Side } from '@/engine';
import { DERIVED_KINDS, predictNext } from '@/roads';
import type { RoadResult } from '@/roads';
import { explainRoadEntry, generateRoadQuestion, randomRoadResults } from './road';
import { questionSeed } from './seeds';

function seq(spec: string): RoadResult[] {
  return spec
    .replace(/\s+/g, '')
    .split('')
    .map((ch) => ({ outcome: ch === 'P' ? 'player' : ch === 'B' ? 'banker' : 'tie' }));
}

describe('generateRoadQuestion', () => {
  it('always asks about an entry that predictNext produces, on a readable shoe', () => {
    const kinds = new Set<string>();
    const sides = new Set<string>();
    const colors = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const q = generateRoadQuestion(createRng(questionSeed(seed, 0)));
      expect(q.results.length).toBeGreaterThanOrEqual(10);
      expect(q.results.length).toBeLessThanOrEqual(30);
      expect(q.results.filter((r) => r.outcome === 'tie').length).toBeLessThanOrEqual(3);
      expect(predictNext(q.results, q.side)[q.kind]).toBe(q.answer);
      kinds.add(q.kind);
      sides.add(q.side);
      colors.add(q.answer);
    }
    expect(kinds.size).toBe(3);
    expect(sides.size).toBe(2);
    expect(colors.size).toBe(2);
  });

  it('is deterministic for a seed', () => {
    expect(generateRoadQuestion(createRng(42))).toEqual(generateRoadQuestion(createRng(42)));
  });
});

describe('explainRoadEntry', () => {
  it('matches a hand-derived example', () => {
    // B B P P P B → logical columns L = [2, 3, 1].
    const results = seq('BBPPPB');
    // Next B continues column 3 as its 2nd cell: big eye boy looks at column 2 (3 deep ≥ 2) → red;
    // small road looks at column 1 (2 deep ≥ 2) → red; cockroach needs column 0 → no entry.
    const bigEyeB = explainRoadEntry(results, 'bigEye', 'banker');
    expect(bigEyeB?.color).toBe('red');
    expect(bigEyeB?.newColumn).toBe(false);
    expect(bigEyeB?.col).toBe(3);
    expect(bigEyeB?.row).toBe(2);
    expect(bigEyeB?.text.join(' ')).toMatch(/column 2, which is 3 deep/);
    expect(explainRoadEntry(results, 'small', 'banker')?.color).toBe('red');
    expect(explainRoadEntry(results, 'cockroach', 'banker')).toBeNull();
    // Next P starts column 4: big eye boy compares columns 3 (1) and 2 (3) → blue;
    // small road compares columns 3 (1) and 1 (2) → blue; cockroach needs column 0 → no entry.
    const bigEyeP = explainRoadEntry(results, 'bigEye', 'player');
    expect(bigEyeP?.color).toBe('blue');
    expect(bigEyeP?.newColumn).toBe(true);
    expect(bigEyeP?.col).toBe(4);
    expect(bigEyeP?.text.join(' ')).toMatch(/column 3 is 1 deep, column 2 is 3 deep/);
    expect(explainRoadEntry(results, 'small', 'player')?.color).toBe('blue');
    expect(explainRoadEntry(results, 'cockroach', 'player')).toBeNull();
    // Agreement with the roads module on the same example.
    expect(predictNext(results, 'banker')).toEqual({ bigEye: 'red', small: 'red', cockroach: null });
    expect(predictNext(results, 'player')).toEqual({ bigEye: 'blue', small: 'blue', cockroach: null });
  });

  it('covers the "stopped earlier → red" case', () => {
    // B B B B P P B B → L = [4, 2, 2]. Next B is cell 3 of column 3; big eye boy looks at column 2 (2 deep):
    // it stopped exactly one row short → blue. Small road looks at column 1 (4 deep ≥ 3) → red.
    const results = seq('BBBBPPBB');
    expect(explainRoadEntry(results, 'bigEye', 'banker')?.color).toBe('blue');
    expect(explainRoadEntry(results, 'small', 'banker')?.color).toBe('red');
    // P P P P B B B B P P P P → L = [4, 4, 4]; next P is cell 5 of column 3; column 2 (4 deep) stopped exactly
    // one short → blue. Now P P P P B P P P P: L = [4, 1, 4], next P is cell 5 of column 3: column 2 stopped at
    // row 1 (three rows short) → red.
    expect(explainRoadEntry(seq('PPPPBBBBPPPP'), 'bigEye', 'player')?.color).toBe('blue');
    const earlier = explainRoadEntry(seq('PPPPBPPPP'), 'bigEye', 'player');
    expect(earlier?.color).toBe('red');
    expect(earlier?.text.join(' ')).toMatch(/no cell in row 4 either/);
  });

  it('agrees with predictNext on random shoes, ties included', () => {
    const rng = createRng(2024);
    for (let i = 0; i < 1500; i++) {
      const results = randomRoadResults(rng, 4 + rng.nextInt(40));
      if (rng.next() < 0.2) results.push({ outcome: 'tie' });
      for (const side of ['player', 'banker'] as Side[]) {
        const oracle = predictNext(results, side);
        for (const kind of DERIVED_KINDS) {
          const mine = explainRoadEntry(results, kind, side);
          expect(mine?.color ?? null).toBe(oracle[kind]);
          if (mine) expect(mine.text).toHaveLength(3);
        }
      }
    }
  });
});
