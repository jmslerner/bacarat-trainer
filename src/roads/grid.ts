/**
 * Shared cell-placement engine for the big road and the three derived roads (internal).
 *
 * Both follow the same casino display rules: a run of identical keys (a LOGICAL column) grows DOWN the
 * physical column it started in. When the next cell down would be off the grid (row > rows) OR is already
 * occupied, the run turns RIGHT instead (same row, col + 1) — the "dragon tail" — and keeps going right.
 * A new logical column starts at physical column `previous.startCol + 1`, row 1, moving right until a free
 * cell is found.
 *
 * Coordinates are 1-based (col 1 = leftmost, row 1 = top).
 */
export interface GridPosition {
  col: number;
  row: number;
  logicalCol: number;
  logicalRow: number;
}

export interface GridColumn<K> {
  key: K;
  length: number;
  startCol: number;
}

export function assertRows(rows: number): void {
  if (!Number.isInteger(rows) || rows < 1) {
    throw new RangeError(`rows must be a positive integer, got ${String(rows)}`);
  }
}

export class GridPlacer<K> {
  readonly rows: number;
  readonly columns: GridColumn<K>[] = [];
  /** Highest physical column used so far (0 while empty). */
  width = 0;

  private readonly occupied = new Set<number>();
  private current: GridColumn<K> | null = null;
  private col = 0;
  private row = 0;
  private tail = false;

  constructor(rows: number) {
    assertRows(rows);
    this.rows = rows;
  }

  isOccupied(col: number, row: number): boolean {
    return this.occupied.has(this.key(col, row));
  }

  /** Places the next cell and returns where it went. */
  place(key: K): GridPosition {
    let current = this.current;
    if (current === null || current.key !== key) {
      // New logical column: one physical column right of where the previous streak started, on row 1.
      let col = current === null ? 1 : current.startCol + 1;
      while (this.isOccupied(col, 1)) col += 1;
      current = { key, length: 1, startCol: col };
      this.columns.push(current);
      this.current = current;
      this.tail = false;
      this.col = col;
      this.row = 1;
    } else {
      current.length += 1;
      if (!this.tail && this.row < this.rows && !this.isOccupied(this.col, this.row + 1)) {
        this.row += 1;
      } else {
        // Dragon tail: blocked by the bottom edge or an occupied cell → turn right and keep going right.
        this.tail = true;
        let col = this.col + 1;
        while (this.isOccupied(col, this.row)) col += 1;
        this.col = col;
      }
    }
    this.occupied.add(this.key(this.col, this.row));
    if (this.col > this.width) this.width = this.col;
    return { col: this.col, row: this.row, logicalCol: this.columns.length, logicalRow: current.length };
  }

  private key(col: number, row: number): number {
    return col * (this.rows + 1) + row;
  }
}
