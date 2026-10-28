import { useMemo } from 'react';
import type { Side } from '@/engine';
import { bigRoad } from '../bigRoad';
import { bonusOf } from '../bonus';
import type { RoadResult } from '../types';
import { RoadFrame } from './RoadFrame';
import { BigRoadSymbol, TieMark, cellCenter } from './symbols';

export interface BigRoadViewProps {
  results: readonly RoadResult[];
  /** Columns visible without scrolling (default 30). */
  cols?: number;
  /** Grid rows (default 6). */
  rows?: number;
  /** When set, draws a dashed "ghost" cell where this side's next result would land. */
  prediction?: Side | null;
  className?: string;
}

/**
 * Big road: hollow circles (red B / blue P) with the letter inside, green tie strokes, pair dots, dragon tails; a
 * Dragon 7 / Panda 8 hand carries a corner medallion (looked up from `results`, so the road algorithm is untouched).
 */
export function BigRoadView({ results, cols = 30, rows = 6, prediction = null, className }: BigRoadViewProps) {
  const road = useMemo(() => bigRoad(results, rows), [results, rows]);
  const ghost = useMemo(() => {
    if (prediction === null) return null;
    return bigRoad([...results, { outcome: prediction }], rows).cells.at(-1) ?? null;
  }, [results, rows, prediction]);

  const used = Math.max(road.width, ghost?.col ?? 0);
  const totalCols = Math.max(cols, used + 1);
  const counts = { player: 0, banker: 0, tie: 0 };
  for (const result of results) counts[result.outcome] += 1;
  const label = `Big road: ${counts.player} Player, ${counts.banker} Banker, ${counts.tie} Tie`;
  const newest = results.length - 1;

  return (
    <RoadFrame
      cols={cols}
      rows={rows}
      totalCols={totalCols}
      label={label}
      scrollKey={`${results.length}:${prediction ?? ''}`}
      road="big"
      className={className}
    >
      {road.cells.length === 0 && road.leadingTies > 0 && (
        <g data-leading-ties={road.leadingTies}>
          <TieMark {...cellCenter(1, 1)} count={road.leadingTies} />
        </g>
      )}
      {road.cells.map((cell, i) => (
        <BigRoadSymbol
          key={cell.handIndex}
          cell={cell}
          ties={cell.ties + (i === 0 ? road.leadingTies : 0)}
          bonus={bonusOf(results[cell.handIndex])}
          hand={cell.handIndex + 1}
          latest={cell.handIndex === newest}
        />
      ))}
      {ghost !== null && <BigRoadSymbol cell={ghost} ties={0} ghost />}
    </RoadFrame>
  );
}
