import type { Side } from '@/engine';
import { GridPlacer } from './grid';
import type { BigRoad, BigRoadCell, RoadResult } from './types';

/**
 * Big road. Only Player/Banker results create cells; the same outcome continues DOWN the current column, a
 * change starts a new column at row 1. A tie creates no cell: it increments `ties` on the most recent cell,
 * or `leadingTies` when no cell exists yet. Dragon tails: when the next cell down is off the grid or already
 * occupied, the cell goes RIGHT instead and keeps going right. `columns` holds the LOGICAL columns (full
 * streak lengths, independent of tails).
 *
 * The first cell is always at (1,1); a view should show `leadingTies` on it (the leading tie mark is
 * "overwritten" by that cell and carries the count).
 */
export function bigRoad(results: readonly RoadResult[], rows = 6): BigRoad {
  const placer = new GridPlacer<Side>(rows);
  const cells: BigRoadCell[] = [];
  let leadingTies = 0;

  for (let handIndex = 0; handIndex < results.length; handIndex += 1) {
    const result = results[handIndex];
    if (result.outcome === 'tie') {
      const last = cells.at(-1);
      if (last === undefined) leadingTies += 1;
      else last.ties += 1;
      continue;
    }
    const pos = placer.place(result.outcome);
    cells.push({
      col: pos.col,
      row: pos.row,
      outcome: result.outcome,
      ties: 0,
      playerPair: result.playerPair === true,
      bankerPair: result.bankerPair === true,
      handIndex,
      logicalCol: pos.logicalCol,
      logicalRow: pos.logicalRow,
    });
  }

  return {
    cells,
    columns: placer.columns.map((c) => ({ outcome: c.key, length: c.length, startCol: c.startCol })),
    leadingTies,
    width: placer.width,
    rows,
  };
}
