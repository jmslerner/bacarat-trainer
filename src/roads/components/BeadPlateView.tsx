import { useMemo } from 'react';
import { beadPlate } from '../beadPlate';
import { bonusOf } from '../bonus';
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

/**
 * Bead plate: every hand as a solid disc (P blue, B red, T green) with pair dots; a Dragon 7 / Panda 8 bead becomes
 * a medallion, and the newest one pulses.
 */
export function BeadPlateView({ results, cols = 14, rows = 6, className }: BeadPlateViewProps) {
  const cells = useMemo(() => beadPlate(results, rows), [results, rows]);
  // Always keep the column where the next bead will land in view.
  const totalCols = Math.max(cols, Math.ceil((results.length + 1) / rows));
  const label = `Bead plate: ${results.length} ${results.length === 1 ? 'hand' : 'hands'}`;
  // The newest hand, when it is a hit: its bead pulses (a new hand is a new element, so the pulse restarts per hit).
  const latest = bonusOf(results.at(-1)) === null ? -1 : results.length - 1;
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
        <BeadSymbol key={cell.handIndex} cell={cell} latest={cell.handIndex === latest} />
      ))}
    </RoadFrame>
  );
}
