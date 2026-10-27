/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * Everything random in the engine (shuffling, simulations) goes through an `Rng`, so a seed fully
 * determines every shoe and every hand: the same seed always reproduces the same game.
 */
export interface Rng {
  /** The seed this generator was created with, normalized to an unsigned 32-bit integer. */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). `maxExclusive` must be a positive integer. */
  nextInt(maxExclusive: number): number;
}

const TWO_POW_32 = 4294967296;

/** Normalizes any number to the unsigned 32-bit seed actually used by `createRng`. */
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  return seed >>> 0;
}

/**
 * Creates a mulberry32 generator. With no seed, a cryptographically random seed is drawn
 * (`randomSeed()`); read it back from `rng.seed` to reproduce the run later.
 */
export function createRng(seed?: number): Rng {
  const normalized = seed === undefined ? randomSeed() : normalizeSeed(seed);
  let state = normalized | 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / TWO_POW_32;
  };

  return {
    seed: normalized,
    next,
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
        throw new RangeError(`nextInt: maxExclusive must be a positive integer (got ${maxExclusive})`);
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}

/** A fresh unsigned 32-bit seed from the platform's secure RNG (falls back to Math.random). */
export function randomSeed(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    cryptoApi.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * TWO_POW_32) >>> 0;
}
