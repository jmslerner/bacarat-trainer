import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '@/engine';
import { runSimulation } from './simulate';
import { simulateInWorker, SimulationCancelledError } from './simulateInWorker';
import type { SimConfig } from './types';

const cfg: SimConfig = {
  rules: DEFAULT_RULES,
  strategy: { selectorId: 'followLast', systemId: 'paroli', unit: 25, sideBets: { dragon7: 'count', panda8: 'count', units: 1 } },
  bankroll: 2000,
  shoesPerTrial: 2,
  trials: 6,
  seed: 777,
};

describe('simulateInWorker (no Worker in node → same-thread fallback)', () => {
  it('resolves with the same deterministic result as runSimulation and reports progress', async () => {
    expect(typeof Worker).toBe('undefined');
    const progress: number[] = [];
    const sync = runSimulation(cfg);
    const result = await simulateInWorker(cfg, (done) => progress.push(done)).promise;
    const strip = ({ elapsedMs: _e, ...rest }: typeof sync) => rest;
    expect(strip(result)).toEqual(strip(sync));
    expect(progress[progress.length - 1]).toBe(cfg.trials);
  });

  it('cancel() before the run starts rejects with SimulationCancelledError', async () => {
    const run = simulateInWorker(cfg);
    run.cancel();
    await expect(run.promise).rejects.toBeInstanceOf(SimulationCancelledError);
    run.cancel(); // no-op once settled
  });

  it('rejects on an invalid config', async () => {
    await expect(simulateInWorker({ ...cfg, trials: 0 }).promise).rejects.toThrow(/Invalid simulation config/);
  });
});
