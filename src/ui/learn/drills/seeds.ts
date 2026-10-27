/**
 * Deterministic question seeds.
 *
 * A drill mounted with `seed` generates question `i` from `questionSeed(seed, i)`, so the sequence of questions
 * is reproducible (tests), idempotent under React's double-invoked initialisers (StrictMode) and independent
 * of how many times a component re-renders.
 */
import { useCallback, useMemo, useState } from 'react';
import { normalizeSeed, randomSeed } from '@/engine';

/** Mixes a base seed and a question index into a well-spread 32-bit seed. */
export function questionSeed(seed: number, index: number): number {
  let x = (normalizeSeed(seed) + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export interface QuestionSeries {
  /** The base seed (the prop, or the random seed drawn on mount). */
  baseSeed: number;
  /** 0-based index of the current question. */
  index: number;
  /** Seed of the current question. */
  currentSeed: number;
  /** Advance to the next question. */
  next(): void;
  /** Start over at question 0 of a fresh random (or given) seed. */
  restart(seed?: number): void;
}

/** Keeps the base seed and the question index of a drill. */
export function useQuestionSeries(seed?: number): QuestionSeries {
  const [baseSeed, setBaseSeed] = useState<number>(() => (seed === undefined ? randomSeed() : normalizeSeed(seed)));
  const [index, setIndex] = useState(0);
  const next = useCallback(() => setIndex((i) => i + 1), []);
  const restart = useCallback((s?: number) => {
    setBaseSeed(s === undefined ? randomSeed() : normalizeSeed(s));
    setIndex(0);
  }, []);
  return useMemo(
    () => ({ baseSeed, index, currentSeed: questionSeed(baseSeed, index), next, restart }),
    [baseSeed, index, next, restart],
  );
}

/** Fisher–Yates shuffle with the drill's RNG (returns a new array). */
export function shuffled<T>(items: readonly T[], nextInt: (maxExclusive: number) => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Picks an index according to positive weights. */
export function weightedIndex(weights: readonly number[], next: () => number): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
