/**
 * Runs a simulation through `simulateInWorker` (a Web Worker in browsers) with progress, cancel and a wall clock.
 * The last completed result stays on screen while the next run is in progress.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { simulateInWorker, SimulationCancelledError } from '@/strategy';
import type { SimConfig, SimResult, WorkerSimulation } from '@/strategy';

export type RunStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

export interface RunnerState {
  status: RunStatus;
  /** Configuration of the run in progress, or of the most recent attempt. */
  attempt: SimConfig | null;
  progress: { done: number; total: number };
  /** The most recent completed result (kept while a new run is in progress). */
  result: SimResult | null;
  error: string | null;
  startedAt: number | null;
  /** Wall-clock milliseconds of the current / last attempt. */
  elapsedMs: number;
}

export interface SimulationRunner {
  state: RunnerState;
  run(config: SimConfig): void;
  cancel(): void;
}

const IDLE: RunnerState = { status: 'idle', attempt: null, progress: { done: 0, total: 0 }, result: null, error: null, startedAt: null, elapsedMs: 0 };

export function useSimulationRunner(): SimulationRunner {
  const [state, setState] = useState<RunnerState>(IDLE);
  const handle = useRef<WorkerSimulation | null>(null);
  const runId = useRef(0);

  const run = useCallback((config: SimConfig) => {
    handle.current?.cancel(); // a previous run still in flight: its rejection is ignored below
    const id = ++runId.current;
    const startedAt = Date.now();
    setState((s) => ({ ...s, status: 'running', attempt: config, progress: { done: 0, total: config.trials }, error: null, startedAt, elapsedMs: 0 }));
    const sim = simulateInWorker(config, (done, total) => {
      if (runId.current !== id) return;
      setState((s) => ({ ...s, progress: { done, total }, elapsedMs: Date.now() - startedAt }));
    });
    handle.current = sim;
    sim.promise.then(
      (result) => {
        if (runId.current !== id) return;
        handle.current = null;
        setState((s) => ({ ...s, status: 'done', result, progress: { done: result.trials, total: result.trials }, elapsedMs: Date.now() - startedAt }));
      },
      (error: unknown) => {
        if (runId.current !== id) return;
        handle.current = null;
        const elapsedMs = Date.now() - startedAt;
        if (error instanceof SimulationCancelledError) setState((s) => ({ ...s, status: 'cancelled', elapsedMs }));
        else setState((s) => ({ ...s, status: 'error', error: error instanceof Error ? error.message : String(error), elapsedMs }));
      },
    );
  }, []);

  const cancel = useCallback(() => {
    handle.current?.cancel();
  }, []);

  // Tick the clock while a run is in progress.
  useEffect(() => {
    if (state.status !== 'running' || state.startedAt === null) return;
    const started = state.startedAt;
    const timer = setInterval(() => setState((s) => (s.status === 'running' ? { ...s, elapsedMs: Date.now() - started } : s)), 250);
    return () => clearInterval(timer);
  }, [state.status, state.startedAt]);

  // Stop the worker when the view goes away.
  useEffect(
    () => () => {
      runId.current++;
      handle.current?.cancel();
      handle.current = null;
    },
    [],
  );

  return { state, run, cancel };
}
