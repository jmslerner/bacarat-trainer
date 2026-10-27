import { assertRows } from './grid';
import type { BeadCell, RoadResult } from './types';

/**
 * Bead plate: every hand, in order, fills a `rows`-row grid column by column, top to bottom.
 * Returns the cells in hand order (column-major). Coordinates are 1-based.
 */
export function beadPlate(results: readonly RoadResult[], rows = 6): BeadCell[] {
  assertRows(rows);
  return results.map((result, handIndex) => ({
    col: Math.floor(handIndex / rows) + 1,
    row: (handIndex % rows) + 1,
    outcome: result.outcome,
    playerPair: result.playerPair === true,
    bankerPair: result.bankerPair === true,
    dragon7: result.dragon7 === true,
    panda8: result.panda8 === true,
    handIndex,
  }));
}
