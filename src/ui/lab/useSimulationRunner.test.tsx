// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import type { SimResult, WorkerSimulation } from '@/strategy';
import { fakeConfig, fakeResult } from './testHelpers';
import { ProgressPanel } from './components/RunPanels';
import { useSimulationRunner, type RunnerState } from './useSimulationRunner';

/** A controllable stand-in for simulateInWorker: the test settles the promise and drives progress itself. */
interface Fake extends WorkerSimulation {
  resolve(result: SimResult): void;
  reject(error: Error): void;
  progress(done: number, total: number): void;
  cancelled: number;
}

const fakes: Fake[] = [];
vi.mock('@/strategy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/strategy')>();
  return {
    ...actual,
    simulateInWorker: (_config: unknown, onProgress?: (done: number, total: number) => void): WorkerSimulation => {
      let resolve!: (r: SimResult) => void;
      let reject!: (e: Error) => void;
      const promise = new Promise<SimResult>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const fake: Fake = {
        promise,
        cancelled: 0,
        cancel() {
          fake.cancelled++;
          reject(new actual.SimulationCancelledError());
        },
        resolve,
        reject,
        progress: (done, total) => onProgress?.(done, total),
      };
      fakes.push(fake);
      return fake;
    },
  };
});

afterEach(() => {
  cleanup();
  fakes.length = 0;
});

const flush = (): Promise<void> => act(() => new Promise<void>((r) => setTimeout(r, 0)));

describe('useSimulationRunner', () => {
  it('streams progress, keeps the previous result while re-running and reports completion', async () => {
    const { result } = renderHook(() => useSimulationRunner());
    expect(result.current.state).toMatchObject({ status: 'idle', result: null, progress: { done: 0, total: 0 } });
    const config = fakeConfig({ trials: 50 });
    act(() => result.current.run(config));
    expect(result.current.state).toMatchObject({ status: 'running', attempt: config, progress: { done: 0, total: 50 }, error: null });
    act(() => fakes[0].progress(20, 50));
    expect(result.current.state.progress).toEqual({ done: 20, total: 50 });
    const first = fakeResult({}, { trials: 50 });
    await act(async () => fakes[0].resolve(first));
    expect(result.current.state).toMatchObject({ status: 'done', result: first, progress: { done: 50, total: 50 } });

    act(() => result.current.run(fakeConfig({ trials: 10 })));
    expect(result.current.state.status).toBe('running');
    expect(result.current.state.result).toBe(first); // still on screen while the next run is in progress
    const second = fakeResult({}, { trials: 10 });
    await act(async () => fakes[1].resolve(second));
    expect(result.current.state.result).toBe(second);
  });

  it('reports a cancel and an error without losing the last result', async () => {
    const { result } = renderHook(() => useSimulationRunner());
    act(() => result.current.run(fakeConfig()));
    const first = fakeResult();
    await act(async () => fakes[0].resolve(first));
    act(() => result.current.run(fakeConfig()));
    act(() => result.current.cancel());
    await flush();
    expect(fakes[1].cancelled).toBe(1);
    expect(result.current.state).toMatchObject({ status: 'cancelled', result: first, error: null });

    act(() => result.current.run(fakeConfig()));
    await act(async () => fakes[2].reject(new Error('worker exploded')));
    expect(result.current.state).toMatchObject({ status: 'error', error: 'worker exploded', result: first });
  });

  it('ignores the outcome of a run that was superseded and cancels the worker on unmount', async () => {
    const { result, unmount } = renderHook(() => useSimulationRunner());
    act(() => result.current.run(fakeConfig({ seed: 1 })));
    act(() => result.current.run(fakeConfig({ seed: 2 })));
    expect(fakes[0].cancelled).toBe(1); // the first run is stopped when the second starts
    await flush();
    expect(result.current.state.status).toBe('running'); // the first run's cancellation does not touch the second
    const stale = fakeResult({ meanFinal: 1 });
    await act(async () => fakes[0].resolve(stale));
    expect(result.current.state.result).toBeNull();
    unmount();
    expect(fakes[1].cancelled).toBe(1);
  });
});

describe('ProgressPanel', () => {
  const base: RunnerState = { status: 'idle', attempt: null, progress: { done: 0, total: 0 }, result: null, error: null, startedAt: null, elapsedMs: 0 };

  it('renders nothing when idle or done, a progress bar while running, and an alert on failure', () => {
    const { rerender } = render(<ProgressPanel state={base} onCancel={() => {}} />);
    expect(screen.queryByTestId('lab-progress')).toBeNull();
    rerender(<ProgressPanel state={{ ...base, status: 'done' }} onCancel={() => {}} />);
    expect(screen.queryByTestId('lab-progress')).toBeNull();
    rerender(<ProgressPanel state={{ ...base, status: 'running', progress: { done: 250, total: 1000 }, startedAt: 1, elapsedMs: 1234 }} onCancel={() => {}} />);
    const bar = screen.getByRole('progressbar', { name: 'Simulation progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuetext', '250 of 1,000 trials');
    expect(screen.getByTestId('lab-status')).toHaveTextContent('Running trial 250 of 1,000 · 1.2 s');
    rerender(<ProgressPanel state={{ ...base, status: 'cancelled', elapsedMs: 12_600 }} onCancel={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Simulation cancelled after 13 s.');
    rerender(<ProgressPanel state={{ ...base, status: 'error', error: 'worker exploded' }} onCancel={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The simulation failed: worker exploded');
  });
});
