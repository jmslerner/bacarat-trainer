/**
 * The comparison table: the current (unsaved) result and up to six saved runs side by side, best figure per
 * column highlighted, with Load (back into the form) and Remove actions.
 */
import type { ReactNode } from 'react';
import { Button, cx, formatMoney, formatNumber, formatPercent } from '@/ui/shell';
import { formatEdgeRange } from '../edge';
import type { RunSummary, SavedRun } from '../savedRuns';
import styles from '../Lab.module.css';

export interface CurrentRun {
  name: string;
  rulesSummary: string;
  summary: RunSummary;
}

export interface SavedRunsTableProps {
  runs: readonly SavedRun[];
  /** The result on screen when it has not been saved yet. */
  current: CurrentRun | null;
  maxRuns: number;
  onLoad(run: SavedRun): void;
  onRemove(run: SavedRun): void;
  onClear(): void;
  onSaveCurrent(): void;
}

interface Column {
  key: string;
  label: string;
  value(s: RunSummary): number | null;
  format(s: RunSummary): string;
  /** Which end of the column is best, when comparable. */
  best?: 'max' | 'min';
}

const COLUMNS: readonly Column[] = [
  { key: 'mean', label: 'Mean final', value: (s) => s.meanFinal, format: (s) => formatMoney(s.meanFinal), best: 'max' },
  { key: 'median', label: 'Median', value: (s) => s.medianFinal, format: (s) => formatMoney(s.medianFinal), best: 'max' },
  { key: 'pProfit', label: 'P(profit)', value: (s) => s.pProfit, format: (s) => formatPercent(s.pProfit, 1), best: 'max' },
  { key: 'pRuin', label: 'P(ruin)', value: (s) => s.pRuin, format: (s) => formatPercent(s.pRuin, 1), best: 'min' },
  { key: 'realized', label: 'Realized edge', value: (s) => (s.totalWagered > 0 ? s.realizedEdge : null), format: (s) => (s.totalWagered > 0 ? formatPercent(s.realizedEdge, 2) : '—'), best: 'min' },
  { key: 'exact', label: 'Exact edge', value: () => null, format: (s) => (s.expectedEdge ? formatEdgeRange(s.expectedEdge) : '—') },
  { key: 'drawdown', label: 'Mean drawdown', value: (s) => s.meanMaxDrawdown, format: (s) => formatMoney(s.meanMaxDrawdown), best: 'min' },
  { key: 'hands', label: 'Hands', value: () => null, format: (s) => formatNumber(s.handsPlayed) },
];

function bestValue(column: Column, rows: readonly RunSummary[]): number | null {
  if (!column.best || rows.length < 2) return null;
  const values = rows.map(column.value).filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const best = column.best === 'max' ? Math.max(...values) : Math.min(...values);
  // No "best" when every row is equal.
  return values.every((v) => v === best) ? null : best;
}

function runDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function SavedRunsTable({ runs, current, maxRuns, onLoad, onRemove, onClear, onSaveCurrent }: SavedRunsTableProps): ReactNode {
  const rows: Array<{ id: string; name: string; sub: string; summary: RunSummary; saved: SavedRun | null }> = [];
  if (current) rows.push({ id: 'current', name: current.name, sub: `This run · ${current.rulesSummary}`, summary: current.summary, saved: null });
  for (const run of runs) rows.push({ id: run.id, name: run.name, sub: `${runDate(run.savedAt)} · ${run.rulesSummary}`, summary: run.summary, saved: run });
  const summaries = rows.map((r) => r.summary);
  const bests = COLUMNS.map((c) => bestValue(c, summaries));

  return (
    <div className={styles.card} data-testid="lab-saved-runs">
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Compare runs</h2>
          <p className={styles.cardSub}>
            {runs.length} of {maxRuns} saved in this browser · the best figure in each column is marked
          </p>
        </div>
        {runs.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onClear} data-testid="lab-clear-runs">
            Clear saved runs
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className={styles.emptyRuns}>No runs yet. Run a simulation and save it to compare strategies side by side.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Size</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={cx(row.saved === null && styles.rowCurrent)} data-testid={row.saved ? 'lab-saved-row' : 'lab-current-row'}>
                  <td className={styles.runName}>
                    {row.name}
                    <span className={styles.runSub}>{row.sub}</span>
                  </td>
                  <td>
                    {formatNumber(row.summary.trials)} × {formatNumber(row.summary.shoesPerTrial)}
                    <span className={styles.runSub}>
                      {formatMoney(row.summary.bankroll)} · unit {formatMoney(row.summary.unit)} · seed {row.summary.seed}
                    </span>
                  </td>
                  {COLUMNS.map((c, i) => {
                    const v = c.value(row.summary);
                    const best = bests[i] !== null && v !== null && v === bests[i];
                    return (
                      <td key={c.key} className={cx(best && styles.best)}>
                        {c.format(row.summary)}
                        {best && <span className="sr-only"> (best)</span>}
                      </td>
                    );
                  })}
                  <td>
                    <div className={styles.actions}>
                      {row.saved ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => onLoad(row.saved as SavedRun)} aria-label={`Load the settings of ${row.name}`}>
                            Load
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onRemove(row.saved as SavedRun)} aria-label={`Remove ${row.name}`}>
                            Remove
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="primary" onClick={onSaveCurrent}>
                          Save
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
