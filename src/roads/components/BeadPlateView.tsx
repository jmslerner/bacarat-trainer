import { useMemo } from 'react';
import { beadPlate } from '../beadPlate';
import type { RoadResult } from '../types';
import { RoadFrame } from './RoadFrame';
import { BeadSymbol } from './symbols';

export interface BeadPlateViewProps {
  results: readonly RoadResult[];
  /** Columns visible without scrolling (default 14). */
  cols?: number;
  /** Grid rows (default 6). */
  rows?: number;
  className?: string;
}

/** Bead plate: every hand as a solid disc (P blue, B red, T green) with pair dots and D7/P8 markers. */
export function BeadPlateView({ results, cols = 14, rows = 6, className }: BeadPlateViewProps) {
  const cells = useMemo(() => beadPlate(results, rows), [results, rows]);
  // Always keep the column where the next bead will land in view.
  const totalCols = Math.max(cols, Math.ceil((results.length + 1) / rows));
  const label = `Bead plate: ${results.length} ${results.length === 1 ? 'hand' : 'hands'}`;
  return (
    <RoadFrame
      cols={cols}
      rows={rows}
      totalCols={totalCols}
      label={label}
      scrollKey={results.length}
      road="bead"
      className={className}
    >
      {cells.map((cell) => (
        <BeadSymbol key={cell.handIndex} cell={cell} />
      ))}
    </RoadFrame>
  );
}
