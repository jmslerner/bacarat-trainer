/**
 * `@/roads` — casino roadmap algorithms (pure TS) and the SVG components that draw them.
 *
 * Grid coordinates (`col`, `row`, `logicalCol`, `logicalRow`, `startCol`) are 1-based; array positions
 * (`handIndex`, `index`) are 0-based. See `types.ts`.
 */
export type {
  RoadResult,
  BeadCell,
  BigRoadCell,
  BigRoadColumn,
  BigRoad,
  DerivedKind,
  RoadColor,
  DerivedCell,
  DerivedRoad,
  Prediction,
  RoadStats,
} from './types';
export { DERIVED_KINDS, DERIVED_OFFSET, DERIVED_LABELS } from './types';
export { beadPlate } from './beadPlate';
export { bigRoad } from './bigRoad';
export { derivedEntries, derivedEntryAt, derivedRoad, predictNext } from './derived';
export { roadStats } from './stats';

export { BeadPlateView, type BeadPlateViewProps } from './components/BeadPlateView';
export { BigRoadView, type BigRoadViewProps } from './components/BigRoadView';
export { DerivedRoadView, type DerivedRoadViewProps } from './components/DerivedRoadView';
export { Scoreboard, type ScoreboardProps } from './components/Scoreboard';
