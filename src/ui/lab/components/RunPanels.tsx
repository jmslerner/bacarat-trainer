/**
 * The run bar under the form (Run / Cancel, estimated size, problems and warnings) and the progress panel shown
 * in the results column while a simulation runs or after it was cancelled or failed.
 */
import type { ReactNode } from 'react';
import { Button, cx, formatNumber } from '@/ui/shell';
import type { RunnerState } from '../useSimulationRunner';
import styles from '../Lab.module.css';

export interface RunBarProps {
  running: boolean;
  errors: readonly string[];
  warnings: readonly string[];
  /** Estimated hands the run will deal. */
  hands: number;
  onRun(): void;
  onCancel(): void;
}

export function RunBar({ running, errors, warnings, hands, onRun, onCancel }: RunBarProps): ReactNode {
  return (
    <div className={styles.runBar}>
      <div className={styles.runButtons}>
        {running ? (
          <Button variant="danger" size="lg" onClick={onCancel} data-testid="lab-cancel">
            Cancel
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={onRun} disabled={errors.length > 0} data-testid="lab-run">
            Run simulation
          </Button>
        )}
        <span className={styles.runMeta} data-testid="lab-estimate">
          ≈ {formatNumber(hands)} hands, in a background worker
        </span>
      </div>
      {errors.length > 0 && (
        <ul className={styles.problems} data-testid="lab-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className={styles.warnings} data-testid="lab-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface ProgressPanelProps {
  state: RunnerState;
  onCancel(): void;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/** Progress while running; a one-line notice after a cancel or an error. Renders nothing when idle or done. */
export function ProgressPanel({ state, onCancel }: ProgressPanelProps): ReactNode {
  const { status, progress } = state;
  if (status === 'idle' || status === 'done') return null;
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  return (
    <div className={cx(styles.card, styles.progress)} data-testid="lab-progress">
      {status === 'running' && (
        <>
          <div className={styles.progressTrack} role="progressbar" aria-label="Simulation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${formatNumber(progress.done)} of ${formatNumber(progress.total)} trials`}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <div className={styles.statusRow}>
            <p className={styles.status} role="status" data-testid="lab-status">
              Running trial {formatNumber(progress.done)} of {formatNumber(progress.total)} · {seconds(state.elapsedMs)}
            </p>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}
      {status === 'cancelled' && (
        <p className={styles.status} role="status" data-testid="lab-status">
          Simulation cancelled after {seconds(state.elapsedMs)}.
        </p>
      )}
      {status === 'error' && (
        <div className={styles.errorBox} role="alert" data-testid="lab-status">
          The simulation failed: {state.error}
        </div>
      )}
    </div>
  );
}
