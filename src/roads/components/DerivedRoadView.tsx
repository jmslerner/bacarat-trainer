import { useMemo } from 'react';
import type { Side } from '@/engine';
import { bigRoad } from '../bigRoad';
import { derivedRoad } from '../derived';
import { DERIVED_LABELS, type DerivedKind, type RoadResult } from '../types';
import { RoadFrame } from './RoadFrame';
import { DerivedSymbol } from './symbols';

export interface DerivedRoadViewProps {
  results: readonly RoadResult[];
  kind: DerivedKind;
  /** Columns visible without scrolling (default 20). */
  cols?: number;
  /** Grid rows (default 6). */
  rows?: number;
  /** When set, draws a dashed "ghost" entry showing what this side's next result would add. */
  prediction?: Side | null;
  className?: string;
}

/** Big eye boy (hollow circles), small road (solid dots) or cockroach pig (slashes). */
export function DerivedRoadView({
  results,
  kind,
  cols = 20,
  rows = 6,
  prediction = null,
  className,
}: DerivedRoadViewProps) {
  const road = useMemo(() => derivedRoad(bigRoad(results), kind, rows), [results, kind, rows]);
  const ghost = useMemo(() => {
    if (prediction === null) return null;
    const extended = derivedRoad(bigRoad([...results, { outcome: prediction }]), kind, rows);
    return extended.cells.length > road.cells.length ? (extended.cells.at(-1) ?? null) : null;
  }, [results, kind, rows, prediction, road]);

  const used = Math.max(road.width, ghost?.col ?? 0);
  const totalCols = Math.max(cols, used + 1);
  const reds = road.entries.filter((color) => color === 'red').length;
  const label = `${DERIVED_LABELS[kind]}: ${road.entries.length} ${road.entries.length === 1 ? 'entry' : 'entries'}, ${reds} red, ${road.entries.length - reds} blue`;

  return (
    <RoadFrame
      cols={cols}
      rows={rows}
      totalCols={totalCols}
      label={label}
      scrollKey={`${results.length}:${prediction ?? ''}`}
      road={kind}
      className={className}
    >
      {road.cells.map((cell) => (
        <DerivedSymbol key={cell.index} kind={kind} cell={cell} />
      ))}
      {ghost !== null && <DerivedSymbol kind={kind} cell={ghost} ghost />}
    </RoadFrame>
  );
}
