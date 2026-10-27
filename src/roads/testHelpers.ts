import type { RoadResult } from './types';

/** Builds results from a compact spec: 'P' = Player, 'B' = Banker, 'T' = Tie (whitespace ignored). */
export function seq(spec: string): RoadResult[] {
  const out: RoadResult[] = [];
  for (const ch of spec.replace(/\s+/g, '')) {
    if (ch === 'P') out.push({ outcome: 'player' });
    else if (ch === 'B') out.push({ outcome: 'banker' });
    else if (ch === 'T') out.push({ outcome: 'tie' });
    else throw new Error(`Unknown result letter "${ch}"`);
  }
  return out;
}

/** Small deterministic PRNG for property tests (the engine's RNG is not a runtime dependency of this module). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random shoe-like results with realistic frequencies (P 44.6%, B 45.9%, T 9.5%) and pair/bonus flags. */
export function randomResults(rng: () => number, count: number): RoadResult[] {
  const out: RoadResult[] = [];
  for (let i = 0; i < count; i += 1) {
    const u = rng();
    const outcome = u < 0.4462 ? 'player' : u < 0.9048 ? 'banker' : 'tie';
    out.push({
      outcome,
      playerPair: rng() < 0.0747,
      bankerPair: rng() < 0.0747,
      dragon7: outcome === 'banker' && rng() < 0.049,
      panda8: outcome === 'player' && rng() < 0.077,
    });
  }
  return out;
}
