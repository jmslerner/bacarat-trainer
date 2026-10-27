import type { Side } from '@/engine';
import { bigRoad } from './bigRoad';
import { GridPlacer } from './grid';
import {
  DERIVED_OFFSET,
  type BigRoad,
  type BigRoadColumn,
  type DerivedCell,
  type DerivedKind,
  type DerivedRoad,
  type Prediction,
  type RoadColor,
  type RoadResult,
} from './types';

/**
 * Colour of the derived-road entry produced by the big-road cell at LOGICAL (c, r) (both 1-based) for the
 * column offset `k` (1 = big eye boy, 2 = small road, 3 = cockroach pig), given the logical column lengths
 * (`lengths[0]` is column 1). Returns null when that cell produces no entry.
 *
 *  - r === 1 (a new column): requires c >= k + 2; red if L[c-1] === L[c-1-k] else blue.
 *  - r >= 2: requires c >= k + 1; look at column c-k: red if L[c-k] >= r, blue if L[c-k] === r-1,
 *    red if L[c-k] <= r-2.
 */
export function derivedEntryAt(lengths: readonly number[], c: number, r: number, k: number): RoadColor | null {
  if (r === 1) {
    if (c < k + 2) return null;
    return lengths[c - 2] === lengths[c - 2 - k] ? 'red' : 'blue';
  }
  if (c < k + 1) return null;
  const len = lengths[c - 1 - k];
  if (len >= r) return 'red';
  if (len === r - 1) return 'blue';
  return 'red';
}

/** Pure algorithm: the derived road's entries, in order, from the big road's LOGICAL columns (ties ignored). */
export function derivedEntries(columns: readonly BigRoadColumn[], kind: DerivedKind): RoadColor[] {
  const k = DERIVED_OFFSET[kind];
  const lengths = columns.map((column) => column.length);
  const entries: RoadColor[] = [];
  for (let c = 1; c <= lengths.length; c += 1) {
    const length = lengths[c - 1];
    for (let r = 1; r <= length; r += 1) {
      const color = derivedEntryAt(lengths, c, r, k);
      if (color !== null) entries.push(color);
    }
  }
  return entries;
}

/**
 * Lays a derived road out like the big road: the same colour continues down, a colour change starts a new
 * column, with the same dragon-tail rule.
 */
export function derivedRoad(big: BigRoad, kind: DerivedKind, rows = 6): DerivedRoad {
  const entries = derivedEntries(big.columns, kind);
  const placer = new GridPlacer<RoadColor>(rows);
  const cells: DerivedCell[] = entries.map((color, index) => {
    const pos = placer.place(color);
    return { col: pos.col, row: pos.row, color, index };
  });
  return { kind, entries, cells, width: placer.width, rows };
}

/**
 * "Ask the road": append a hypothetical Player or Banker result and return the colour of the NEW entry each
 * derived road would get (null when that road would get no entry).
 */
export function predictNext(results: readonly RoadResult[], next: Side): Prediction {
  const { columns } = bigRoad(results);
  const lengths = columns.map((column) => column.length);
  const last = columns.at(-1);
  let c: number;
  let r: number;
  if (last === undefined || last.outcome !== next) {
    lengths.push(1);
    c = lengths.length;
    r = 1;
  } else {
    c = lengths.length;
    r = last.length + 1;
    lengths[c - 1] = r;
  }
  return {
    bigEye: derivedEntryAt(lengths, c, r, DERIVED_OFFSET.bigEye),
    small: derivedEntryAt(lengths, c, r, DERIVED_OFFSET.small),
    cockroach: derivedEntryAt(lengths, c, r, DERIVED_OFFSET.cockroach),
  };
}
