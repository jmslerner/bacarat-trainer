/**
 * `<LabView />` — the Strategy Lab (SPEC §5.7): configure a strategy, run thousands of sessions in a Web Worker,
 * read the results in plain English and in charts, and compare saved runs.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeStrategy } from '@/strategy';
import type { SimResult } from '@/strategy';
import { ruleSummary, useSettings } from '@/ui/shell';
import { ConfigForm } from './components/ConfigForm';
import { ResultsPanel } from './components/ResultsPanel';
import { ProgressPanel, RunBar } from './components/RunPanels';
import { SavedRunsTable } from './components/SavedRunsTable';
import { defaultLabConfig, resolveRules, sanitizeLabConfig, validateLabConfig, type LabConfig } from './config';
import { expectedEdge } from './edge';
import { MAX_SAVED_RUNS, clearRuns, removeRun, saveRun, summarizeResult, useSavedRuns, type SavedRun } from './savedRuns';
import { useSimulationRunner } from './useSimulationRunner';
import styles from './Lab.module.css';

export interface LabViewProps {
  /** Starting values for the form (tests and deep links); everything else comes from the defaults and settings. */
  initialConfig?: Partial<LabConfig>;
}

export function LabView({ initialConfig }: LabViewProps = {}): ReactNode {
  const { rules: currentRules, buyIn } = useSettings();
  const [config, setConfig] = useState<LabConfig>(() => ({ ...defaultLabConfig({ bankroll: buyIn }), ...initialConfig }));
  const runner = useSimulationRunner();
  const savedRuns = useSavedRuns();
  /** The result whose saved copy is in the table (so "Save" cannot store the same result twice). */
  const [savedResult, setSavedResult] = useState<SimResult | null>(null);
  const formAtRun = useRef<LabConfig>(config);
  const resultsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const previousStatus = useRef(runner.state.status);

  const rules = useMemo(() => resolveRules(config.rulesChoice, currentRules), [config.rulesChoice, currentRules]);
  const validation = useMemo(() => validateLabConfig(config, currentRules), [config, currentRules]);
  const running = runner.state.status === 'running';
  const result = runner.state.result;

  const update = useCallback((patch: Partial<LabConfig>) => setConfig((c) => ({ ...c, ...patch })), []);
  const replace = useCallback((next: LabConfig) => setConfig(next), []);

  const run = useCallback(() => {
    if (validation.errors.length > 0) return;
    formAtRun.current = config;
    runner.run(validation.sim);
  }, [config, runner, validation]);

  // On a stacked layout, bring the fresh results into view once a run completes.
  useEffect(() => {
    const was = previousStatus.current;
    previousStatus.current = runner.state.status;
    if (was !== 'running' || runner.state.status !== 'done') return;
    const el = resultsRef.current;
    if (el && typeof el.scrollIntoView === 'function' && typeof window !== 'undefined' && window.innerWidth <= 1100) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [runner.state.status]);

  const save = useCallback(() => {
    if (!result || savedResult === result) return;
    saveRun({
      name: describeStrategy(result.config.strategy),
      rulesSummary: ruleSummary(result.config.rules),
      form: formAtRun.current,
      summary: summarizeResult(result, expectedEdge(result)),
    });
    setSavedResult(result);
  }, [result, savedResult]);

  const load = useCallback((saved: SavedRun) => {
    setConfig((c) => sanitizeLabConfig(saved.form, c));
    const el = formRef.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const current = useMemo(
    () => (result && savedResult !== result ? { name: describeStrategy(result.config.strategy), rulesSummary: ruleSummary(result.config.rules), summary: summarizeResult(result, expectedEdge(result)) } : null),
    [result, savedResult],
  );

  return (
    <div className={styles.view} data-testid="lab-view">
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Strategy Lab</h1>
          <p className={styles.lede}>
            Pit a bet selector and a money-management system against thousands of simulated sessions, then compare what the house actually kept with the exact house edge. No system beats the edge; counting the side bets is the one place an edge appears.
          </p>
        </div>
        <span className={styles.note}>
          <strong>Table</strong> {ruleSummary(rules)}
        </span>
      </div>

      <div className={styles.layout}>
        <div className={styles.column}>
          <div className={styles.card} ref={formRef}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Strategy</h2>
              <p className={styles.cardSub}>Everything a seat at the table decides</p>
            </div>
            <ConfigForm config={config} rules={rules} currentRules={currentRules} disabled={running} onChange={update} onReplace={replace} />
            <RunBar running={running} errors={validation.errors} warnings={validation.warnings} hands={validation.hands} onRun={run} onCancel={runner.cancel} />
          </div>
        </div>

        <div className={styles.column} ref={resultsRef}>
          <ProgressPanel state={runner.state} onCancel={runner.cancel} />
          {result ? (
            <ResultsPanel result={result} stale={running} saved={savedResult === result} savedCount={savedRuns.length} maxSaved={MAX_SAVED_RUNS} onSave={save} />
          ) : (
            !running && (
              <div className={cxWelcome()} data-testid="lab-welcome">
                <h2 className={styles.cardTitle}>What the Lab shows</h2>
                <ol className={styles.welcomeList}>
                  <li>
                    <strong>Pick a preset or build a strategy.</strong> A bet selector decides which side to bet; a betting system decides how much; the side-bet policy says when to play the Dragon 7 and Panda 8.
                  </li>
                  <li>
                    <strong>Run thousands of sessions.</strong> Every session deals real shoes with the same engine as the table, in a background worker, from a seed you can reproduce.
                  </li>
                  <li>
                    <strong>Compare with the math.</strong> The realized house edge lands on the exact figure whatever the system does with the bet size. Only the count-based side bets move it the player's way.
                  </li>
                </ol>
              </div>
            )
          )}
        </div>

        <div className={styles.full}>
          <SavedRunsTable runs={savedRuns} current={current} maxRuns={MAX_SAVED_RUNS} onLoad={load} onRemove={(r) => removeRun(r.id)} onClear={clearRuns} onSaveCurrent={save} />
        </div>
      </div>
    </div>
  );
}

function cxWelcome(): string {
  return `${styles.card} ${styles.welcome}`;
}
