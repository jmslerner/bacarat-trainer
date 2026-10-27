/**
 * Road drill logic (pure). Generates a random shoe, picks a derived road (Big Eye Boy / Small Road / Cockroach
 * Pig) and a hypothetical next result (Player or Banker) and asks which colour the next entry will be.
 * `predictNext` from @/roads is the oracle; `explainRoadEntry` re-derives the entry from the SPEC rule so the
 * feedback can show WHICH columns were compared.
 */
import { DERIVED_KINDS, DERIVED_LABELS, DERIVED_OFFSET, bigRoad, predictNext } from '@/roads';
import type { DerivedKind, RoadColor, RoadResult } from '@/roads';
import type { Rng, Side } from '@/engine';

export interface RoadQuestion {
  results: RoadResult[];
  kind: DerivedKind;
  side: Side;
  answer: RoadColor;
}

/** How each derived road draws its entries on a casino display. */
export const ROAD_SYMBOL: Readonly<Record<DerivedKind, string>> = {
  bigEye: 'hollow circles',
  small: 'solid dots',
  cockroach: 'slashes',
};

export const SIDE_LABEL: Readonly<Record<Side, string>> = { player: 'Player', banker: 'Banker' };

/** A plausible shoe segment: ~45% Player, ~46% Banker, ~9% Tie (at most three ties, to keep the road readable). */
export function randomRoadResults(rng: Rng, hands: number): RoadResult[] {
  const results: RoadResult[] = [];
  let ties = 0;
  for (let i = 0; i < hands; i++) {
    const r = rng.next();
    if (r < 0.09 && ties < 3) {
      ties++;
      results.push({ outcome: 'tie' });
    } else {
      results.push({ outcome: rng.next() < 0.4955 ? 'player' : 'banker' });
    }
  }
  return results;
}

export function generateRoadQuestion(rng: Rng): RoadQuestion {
  for (let attempt = 0; attempt < 500; attempt++) {
    const results = randomRoadResults(rng, 10 + rng.nextInt(21));
    const kind = DERIVED_KINDS[rng.nextInt(DERIVED_KINDS.length)];
    const side: Side = rng.nextInt(2) === 0 ? 'player' : 'banker';
    const answer = predictNext(results, side)[kind];
    if (answer !== null) return { results, kind, side, answer };
  }
  // Unreachable in practice (a 10–30 hand shoe almost always yields an entry); keep the drill alive anyway.
  const results: RoadResult[] = [{ outcome: 'banker' }, { outcome: 'banker' }, { outcome: 'player' }, { outcome: 'player' }, { outcome: 'banker' }, { outcome: 'player' }];
  const answer = predictNext(results, 'banker').bigEye ?? 'red';
  return { results, kind: 'bigEye', side: 'banker', answer };
}

export interface RoadExplanation {
  color: RoadColor;
  /** Logical big-road position the hypothetical result would occupy. */
  col: number;
  row: number;
  newColumn: boolean;
  /** Sentences for the feedback panel. */
  text: string[];
}

/**
 * Derives the colour of the entry a hypothetical `side` result would add to `kind`, following SPEC §5.2
 * literally, and explains the comparison in words. Returns null when no entry would be produced.
 */
export function explainRoadEntry(results: readonly RoadResult[], kind: DerivedKind, side: Side): RoadExplanation | null {
  const big = bigRoad(results);
  const lengths = big.columns.map((c) => c.length);
  const k = DERIVED_OFFSET[kind];
  const label = DERIVED_LABELS[kind];
  const n = lengths.length;
  const sideLabel = SIDE_LABEL[side];

  let col: number;
  let row: number;
  let newColumn: boolean;
  if (n === 0) {
    col = 1;
    row = 1;
    newColumn = true;
  } else if (big.columns[n - 1].outcome === side) {
    col = n;
    row = lengths[n - 1] + 1;
    newColumn = false;
  } else {
    col = n + 1;
    row = 1;
    newColumn = true;
  }

  if (newColumn) {
    if (col < k + 2) return null;
    const left = lengths[col - 2]; // column col − 1
    const ref = lengths[col - 2 - k]; // column col − 1 − k
    const color: RoadColor = left === ref ? 'red' : 'blue';
    return {
      color,
      col,
      row,
      newColumn,
      text: [
        `A ${sideLabel} here changes the side, so it starts a NEW big-road column (column ${col}).`,
        `For a new column, ${label} compares the two columns ${k === 1 ? '1 and 2' : `1 and ${1 + k}`} to its left: column ${col - 1} is ${left} deep, column ${col - 1 - k} is ${ref} deep.`,
        left === ref ? 'Equal lengths → RED: the shoe is repeating its pattern.' : 'Different lengths → BLUE: the pattern changed.',
      ],
    };
  }

  if (col < k + 1) return null;
  const ref = lengths[col - 1 - k]; // column col − k
  const color: RoadColor = ref >= row ? 'red' : ref === row - 1 ? 'blue' : 'red';
  const verdict =
    ref >= row
      ? `That column also has a cell in row ${row} → RED: a match, the pattern holds.`
      : ref === row - 1
        ? `That column stopped exactly one row short (it is ${ref} deep) → BLUE: the pattern just broke.`
        : `That column stopped at row ${ref}, so it had no cell in row ${row - 1} either → RED: no change from the entry before.`;
  return {
    color,
    col,
    row,
    newColumn,
    text: [
      `A ${sideLabel} here continues the current column: it becomes cell ${row} of column ${col}.`,
      `${label} looks ${k} column${k > 1 ? 's' : ''} to the left, at column ${col - k}, which is ${ref} deep.`,
      verdict,
    ],
  };
}
