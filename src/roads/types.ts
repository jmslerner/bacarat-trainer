import type { Outcome, Side, StreakInfo } from '@/engine';

/**
 * Coordinate conventions used throughout `@/roads`:
 *  - grid positions (`col`, `row`, `logicalCol`, `logicalRow`, `startCol`) are 1-based: col 1 is the leftmost
 *    column and row 1 the top row, exactly as the SPEC words them ("a new column at row 1", "(2,2)/(3,1)");
 *    `width` is the highest physical column in use (0 when the road is empty);
 *  - array positions (`handIndex`, `index`) are 0-based.
 */

/** Minimal shape the roads need from a hand. `HandResult` satisfies it. */
export interface RoadResult {
  outcome: Outcome;
  playerPair?: boolean;
  bankerPair?: boolean;
  dragon7?: boolean;
  panda8?: boolean;
}

export interface BeadCell {
  col: number;
  row: number;
  outcome: Outcome;
  playerPair: boolean;
  bankerPair: boolean;
  dragon7: boolean;
  panda8: boolean;
  /** Index of the hand in the `results` array. */
  handIndex: number;
}

export interface BigRoadCell {
  /** Physical column (1-based). */
  col: number;
  /** Physical row (1-based). */
  row: number;
  outcome: Side;
  /** Ties recorded on this cell (ties that followed it before the next Player/Banker result). */
  ties: number;
  playerPair: boolean;
  bankerPair: boolean;
  handIndex: number;
  /** Logical column (1-based streak number), independent of dragon tails. */
  logicalCol: number;
  /** Position within the streak (1-based). */
  logicalRow: number;
}

export interface BigRoadColumn {
  outcome: Side;
  /** Full streak length (independent of tails). */
  length: number;
  /** Physical column where the streak starts (1-based). */
  startCol: number;
}

export interface BigRoad {
  cells: BigRoadCell[];
  /** The LOGICAL columns, in order. */
  columns: BigRoadColumn[];
  /** Ties recorded before the first Player/Banker result. */
  leadingTies: number;
  /** Highest physical column in use (0 when there are no cells). */
  width: number;
  rows: number;
}

export type DerivedKind = 'bigEye' | 'small' | 'cockroach';
export type RoadColor = 'red' | 'blue';

export interface DerivedCell {
  col: number;
  row: number;
  color: RoadColor;
  /** Index into `DerivedRoad.entries`. */
  index: number;
}

export interface DerivedRoad {
  kind: DerivedKind;
  entries: RoadColor[];
  cells: DerivedCell[];
  width: number;
  rows: number;
}

/** What each derived road would show if the next result were a given side (null = no entry produced). */
export type Prediction = Record<DerivedKind, RoadColor | null>;

export interface RoadStats {
  total: number;
  player: number;
  banker: number;
  tie: number;
  playerPair: number;
  bankerPair: number;
  dragon7: number;
  panda8: number;
  /**
   * Big-road convention: ties never break a streak, so this is the current big-road column (its side and
   * length). When there are no Player/Banker results yet it is `{ outcome: 'tie', length: ties }`, or
   * `{ outcome: null, length: 0 }` for an empty shoe.
   */
  currentStreak: StreakInfo;
  /** Longest Player streak = longest Player big-road column (ties ignored). */
  longestPlayer: number;
  longestBanker: number;
}

export const DERIVED_KINDS: readonly DerivedKind[] = ['bigEye', 'small', 'cockroach'];

/** Column offset k used by each derived road. */
export const DERIVED_OFFSET: Record<DerivedKind, 1 | 2 | 3> = { bigEye: 1, small: 2, cockroach: 3 };

export const DERIVED_LABELS: Record<DerivedKind, string> = {
  bigEye: 'Big Eye Boy',
  small: 'Small Road',
  cockroach: 'Cockroach Pig',
};
