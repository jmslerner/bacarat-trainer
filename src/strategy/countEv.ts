/**
 * Validating a counting system by simulation: deal whole shoes exactly as the engine does at the table, keep the
 * running count from every face-up card (exposed burn card included), and record the realized return of the side
 * bet in each true-count bucket. Used to derive docs/COUNTING.md and COUNT_EV_TABLE, and by the tests.
 */
import { cardValue, createRng, dealHand, DEFAULT_RULES, Shoe } from '@/engine';
import type { HandResult, TableRules } from '@/engine';
import { trueCount } from './counting';
import type { CountEvRow } from './types';

export type SideBetKind = 'dragon7' | 'panda8';

export interface CountEvSystemSpec {
  key: string;
  bet: SideBetKind;
  tags: readonly number[];
}

export interface CountEvBucket extends CountEvRow {
  /** Hands in the bucket on which the side bet hit. */
  wins: number;
  /** Standard error of `ev`. */
  stdErr: number;
}

export interface CountEvStats {
  key: string;
  bet: SideBetKind;
  rows: CountEvBucket[];
  shoes: number;
  totalHands: number;
  /** Realized EV per unit when betting every hand (should match the exact house edge, negated). */
  overallEv: number;
}

export interface CountEvOptions {
  shoes: number;
  seed: number;
  rules?: TableRules;
  /** Interior bucket edges, ascending (default −2, 0, 2, 4, 6, 8 → 7 buckets from −∞ to +∞). */
  edges?: readonly number[];
  onProgress?: (shoesDone: number, shoes: number) => void;
}

export const DEFAULT_TC_EDGES: readonly number[] = Object.freeze([-2, 0, 2, 4, 6, 8]);

const FAST = { withSteps: false } as const;

function bucketOf(tc: number, edges: readonly number[]): number {
  let b = 0;
  while (b < edges.length && tc >= edges[b]) b++;
  return b;
}

/** Deals `shoes` shoes and tabulates each system's side bet by true-count bucket. All systems see the same cards. */
export function simulateCountEv(systems: readonly CountEvSystemSpec[], opts: CountEvOptions): CountEvStats[] {
  const rules = opts.rules ?? DEFAULT_RULES;
  const edges = opts.edges ?? DEFAULT_TC_EDGES;
  for (let i = 1; i < edges.length; i++) if (!(edges[i] > edges[i - 1])) throw new RangeError('Bucket edges must be ascending');
  if (!Number.isInteger(opts.shoes) || opts.shoes < 1) throw new RangeError('shoes must be a positive integer');
  for (const s of systems) if (s.tags.length !== 10) throw new RangeError(`System ${s.key}: a tag set needs 10 entries`);

  const nSys = systems.length;
  const nBuckets = edges.length + 1;
  const tagTables = systems.map((s) => Float64Array.from(s.tags));
  const pays = systems.map((s) => (s.bet === 'dragon7' ? rules.dragon7Pays : rules.panda8Pays));
  const hands = systems.map(() => new Float64Array(nBuckets));
  const wins = systems.map(() => new Float64Array(nBuckets));
  const sumR = systems.map(() => new Float64Array(nBuckets));
  const sumR2 = systems.map(() => new Float64Array(nBuckets));
  const running = new Float64Array(nSys);
  const values = new Int32Array(6);
  let totalHands = 0;
  let totalDragon = 0;
  let totalPanda = 0;

  const rng = createRng(opts.seed);
  const step = Math.max(1, Math.floor(opts.shoes / 100));
  for (let shoeNo = 1; shoeNo <= opts.shoes; shoeNo++) {
    const shoe = new Shoe(rules, rng, shoeNo);
    running.fill(0);
    if (shoe.exposedBurnCard) {
      const v = cardValue(shoe.exposedBurnCard.rank);
      for (let s = 0; s < nSys; s++) running[s] = tagTables[s][v];
    }
    let finalHand = false;
    for (let handNumber = 1; ; handNumber++) {
      const remaining = shoe.cardsRemaining();
      if (remaining < 6) break;
      const result: HandResult = dealHand(shoe, rules, handNumber, FAST);
      totalHands++;
      if (result.dragon7) totalDragon++;
      if (result.panda8) totalPanda++;
      for (let s = 0; s < nSys; s++) {
        const tc = trueCount(running[s], remaining);
        const b = bucketOf(tc, edges);
        const hit = systems[s].bet === 'dragon7' ? result.dragon7 : result.panda8;
        const r = hit ? pays[s] : -1;
        hands[s][b] += 1;
        if (hit) wins[s][b] += 1;
        sumR[s][b] += r;
        sumR2[s][b] += r * r;
      }
      // Update the counts with every card of the hand (dealing order is irrelevant to a sum).
      let n = 0;
      for (let i = 0; i < result.playerCards.length; i++) values[n++] = cardValue(result.playerCards[i].rank);
      for (let i = 0; i < result.bankerCards.length; i++) values[n++] = cardValue(result.bankerCards[i].rank);
      for (let s = 0; s < nSys; s++) {
        const t = tagTables[s];
        let add = 0;
        for (let i = 0; i < n; i++) add += t[values[i]];
        running[s] += add;
      }
      if (finalHand) break;
      if (result.cutCardDrawn) finalHand = true;
    }
    if (opts.onProgress && (shoeNo % step === 0 || shoeNo === opts.shoes)) opts.onProgress(shoeNo, opts.shoes);
  }

  return systems.map((spec, s) => {
    const rows: CountEvBucket[] = [];
    for (let b = 0; b < nBuckets; b++) {
      const n = hands[s][b];
      const ev = n === 0 ? 0 : sumR[s][b] / n;
      const variance = n === 0 ? 0 : Math.max(0, sumR2[s][b] / n - ev * ev);
      rows.push({
        tcMin: b === 0 ? -Infinity : edges[b - 1],
        tcMax: b === edges.length ? Infinity : edges[b],
        hands: n,
        frequency: totalHands === 0 ? 0 : n / totalHands,
        ev,
        wins: wins[s][b],
        stdErr: n === 0 ? 0 : Math.sqrt(variance / n),
      });
    }
    const hits = spec.bet === 'dragon7' ? totalDragon : totalPanda;
    const overallEv = totalHands === 0 ? 0 : (hits * pays[s] - (totalHands - hits)) / totalHands;
    return { key: spec.key, bet: spec.bet, rows, shoes: opts.shoes, totalHands, overallEv };
  });
}

export interface PooledStats {
  hands: number;
  /** Share of all hands at or above the threshold. */
  frequency: number;
  /** Hands-weighted EV per unit of the rows at or above the threshold. */
  ev: number;
  stdErr: number;
  /** Units won per 100 hands dealt when betting one unit whenever the true count is at or above the threshold. */
  returnPerHundredHands: number;
}

/** Pools the buckets at or above `threshold` (hands-weighted EV, combined standard error). */
export function pooledStats(rows: readonly CountEvBucket[], threshold: number): PooledStats {
  let hands = 0;
  let frequency = 0;
  let sumEv = 0;
  let sumVar = 0;
  for (const row of rows) {
    if (row.tcMin < threshold) continue;
    hands += row.hands;
    frequency += row.frequency;
    sumEv += row.hands * row.ev;
    sumVar += row.hands * row.hands * row.stdErr * row.stdErr;
  }
  const ev = hands === 0 ? 0 : sumEv / hands;
  return {
    hands,
    frequency,
    ev,
    stdErr: hands === 0 ? 0 : Math.sqrt(sumVar) / hands,
    returnPerHundredHands: frequency * ev * 100,
  };
}

/**
 * The threshold to bet from: the finite bucket edge that maximizes the return per 100 hands dealt (in the
 * noiseless limit, the lowest edge from which every bucket above is profitable), provided the pooled EV at and
 * above it is more than `sigma` standard errors above zero. Null when no edge qualifies.
 */
export function recommendThreshold(rows: readonly CountEvBucket[], sigma = 2): number | null {
  let best: number | null = null;
  let bestReturn = -Infinity;
  for (const row of rows) {
    if (!Number.isFinite(row.tcMin)) continue;
    const pooled = pooledStats(rows, row.tcMin);
    if (pooled.hands === 0 || pooled.ev <= sigma * pooled.stdErr) continue;
    if (pooled.returnPerHundredHands > bestReturn) {
      bestReturn = pooled.returnPerHundredHands;
      best = row.tcMin;
    }
  }
  return best;
}

/** Units won per 100 hands dealt when betting one unit on every hand whose true count is at or above `threshold`. */
export function returnPerHundredHands(rows: readonly CountEvRow[], threshold: number): number {
  let total = 0;
  for (const row of rows) if (row.tcMin >= threshold) total += row.frequency * row.ev;
  return total * 100;
}

/** Share of hands on which the bet would be placed at `threshold`. */
export function betFrequency(rows: readonly CountEvRow[], threshold: number): number {
  let total = 0;
  for (const row of rows) if (row.tcMin >= threshold) total += row.frequency;
  return total;
}

/** Strips the diagnostics, leaving the SPEC `CountEvRow` shape. */
export function toCountEvRows(rows: readonly CountEvBucket[]): CountEvRow[] {
  return rows.map(({ tcMin, tcMax, hands, frequency, ev }) => ({ tcMin, tcMax, hands, frequency, ev }));
}
