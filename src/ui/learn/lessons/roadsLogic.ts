/**
 * Helpers for the roads lesson: parsing hand sequences and spelling out how the derived roads are built, entry by
 * entry, from the big road's logical columns (SPEC §5.2). The colours produced here are checked against
 * `derivedEntries` from @/roads in the tests.
 */
import { bigRoad, DERIVED_OFFSET, type DerivedKind, type RoadColor, type RoadResult } from '@/roads';
import type { Outcome } from '@/engine';

/** Parses 'P B B T' (any spacing/commas, any case) into road results. Unknown letters throw. */
export function seq(spec: string): RoadResult[] {
  const out: RoadResult[] = [];
  for (const ch of spec.toUpperCase()) {
    if (ch === 'P') out.push({ outcome: 'player' });
    else if (ch === 'B') out.push({ outcome: 'banker' });
    else if (ch === 'T') out.push({ outcome: 'tie' });
    else if (!/[\s,]/.test(ch)) throw new RangeError(`Unknown result letter "${ch}"`);
  }
  return out;
}

/** The fixed sequences the roads lesson renders; the tests check the claims the lesson makes about them. */
export const ROAD_EXAMPLES = Object.freeze({
  intro: 'B B P B B B T P P B',
  ties: 'T B B T P T T P B',
  tail: 'B B B B B B B B P P B',
  /** Big-road column depths 2, 2, 1, 3, 1, 1, 2, 2, 4. */
  derived: 'B B P P B P P P B P B B P P B B B B',
  board: 'B B P B B B T P P B P B B B B P T P B B P P P B P B T B B P B P P B B B P B P B B T P P B B',
});

export const OUTCOME_LETTER: Readonly<Record<Outcome, 'P' | 'B' | 'T'>> = { player: 'P', banker: 'B', tie: 'T' };

export interface DerivationStep {
  /** 0-based index of the derived entry. */
  index: number;
  /** Hand (0-based) whose big-road cell produced the entry. */
  handIndex: number;
  /** Logical big-road position of that cell. */
  col: number;
  row: number;
  color: RoadColor;
  /** Why the entry got its colour, in words. */
  reason: string;
}

/** Column lengths (1-based column → L[col - 1]) formatted for prose. */
function len(lengths: readonly number[], col: number): number {
  return lengths[col - 1];
}

/**
 * Walks the big road cell by cell and explains each derived-road entry (first `limit` entries), exactly as
 * SPEC §5.2 defines them: at logical (c, r) with offset k,
 *  - r = 1 needs c ≥ k + 2: red if L[c−1] = L[c−1−k], else blue;
 *  - r ≥ 2 needs c ≥ k + 1: red if L[c−k] ≥ r, blue if L[c−k] = r − 1, red if L[c−k] ≤ r − 2.
 */
export function deriveWithReasons(results: readonly RoadResult[], kind: DerivedKind, limit = Infinity): DerivationStep[] {
  const k = DERIVED_OFFSET[kind];
  const big = bigRoad(results);
  const lengths = big.columns.map((c) => c.length);
  const steps: DerivationStep[] = [];
  for (const cell of big.cells) {
    if (steps.length >= limit) break;
    const c = cell.logicalCol;
    const r = cell.logicalRow;
    if (r === 1) {
      if (c < k + 2) continue;
      const a = len(lengths, c - 1);
      const b = len(lengths, c - 1 - k);
      const color: RoadColor = a === b ? 'red' : 'blue';
      steps.push({
        index: steps.length,
        handIndex: cell.handIndex,
        col: c,
        row: r,
        color,
        reason:
          `New column ${c}: compare the column just finished (column ${c - 1}, ${a} deep) with column ${c - 1 - k}` +
          ` (${b} deep) — ${a === b ? 'same depth, so red' : 'different depths, so blue'}.`,
      });
    } else {
      if (c < k + 1) continue;
      const target = c - k;
      const t = len(lengths, target);
      let color: RoadColor;
      let why: string;
      if (t >= r) {
        color = 'red';
        why = `column ${target} is at least ${r} deep (${t}), so red`;
      } else if (t === r - 1) {
        color = 'blue';
        why = `column ${target} stopped at exactly ${r - 1}, so blue`;
      } else {
        color = 'red';
        why = `column ${target} is only ${t} deep — short by two or more, so red`;
      }
      steps.push({
        index: steps.length,
        handIndex: cell.handIndex,
        col: c,
        row: r,
        color,
        reason: `Cell ${r} of column ${c}: look ${k} column${k === 1 ? '' : 's'} back — ${why}.`,
      });
    }
  }
  return steps;
}
