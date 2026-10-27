import { describe, expect, it } from 'vitest';
import { createRng, normalizeSeed, randomSeed } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 1000 }, () => a.next());
    const seqB = Array.from({ length: 1000 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(a.seed).toBe(12345);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() stays in [0, 1) and is roughly uniform', () => {
    const rng = createRng(7);
    const buckets = new Array<number>(10).fill(0);
    const n = 200_000;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      const x = rng.next();
      if (x < min) min = x;
      if (x > max) max = x;
      buckets[Math.floor(x * 10)]++;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    for (const count of buckets) {
      expect(count / n).toBeGreaterThan(0.09);
      expect(count / n).toBeLessThan(0.11);
    }
  });

  it('nextInt() returns integers in [0, max) covering every value', () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = rng.nextInt(6);
      if (!Number.isInteger(v) || v < 0 || v >= 6) throw new Error(`nextInt(6) gave ${v}`);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (let i = 0; i < 1000; i++) expect(rng.nextInt(1)).toBe(0);
  });

  it('nextInt() rejects a non-positive or fractional bound', () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-3)).toThrow(RangeError);
    expect(() => rng.nextInt(2.5)).toThrow(RangeError);
    expect(() => rng.nextInt(Number.NaN)).toThrow(RangeError);
  });

  it('normalizes seeds to unsigned 32-bit integers', () => {
    expect(normalizeSeed(-1)).toBe(4294967295);
    expect(normalizeSeed(1.7)).toBe(1);
    expect(normalizeSeed(Number.NaN)).toBe(0);
    expect(createRng(-1).seed).toBe(4294967295);
    const a = createRng(1.7);
    const b = createRng(1);
    expect(a.next()).toBe(b.next());
  });

  it('randomSeed() gives fresh unsigned 32-bit seeds', () => {
    const seeds = Array.from({ length: 20 }, () => randomSeed());
    for (const s of seeds) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(4294967296);
    }
    expect(new Set(seeds).size).toBeGreaterThan(1);
    const rng = createRng();
    expect(Number.isInteger(rng.seed)).toBe(true);
    expect(createRng(rng.seed).next()).toBe(rng.next());
  });
});
