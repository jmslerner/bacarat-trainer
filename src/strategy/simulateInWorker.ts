import { runSimulation } from './simulate';
import type { SimConfig, SimResult } from './types';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

/** The rejection reason of a simulation stopped through `cancel()`. */
export class SimulationCancelledError extends Error {
  constructor() {
    super('Simulation cancelled');
    this.name = 'SimulationCancelledError';
  }
}

export interface WorkerSimulation {
  promise: Promise<SimResult>;
  /** Stops the simulation; the promise rejects with a `SimulationCancelledError`. No-op once settled. */
  cancel(): void;
}

/**
 * Runs the simulation in a Web Worker (a module worker bundled by Vite) so the UI stays responsive, with the
 * same deterministic result as `runSimulation`. Where `Worker` does not exist (node, tests) the simulation
 * runs on the current thread in a macrotask, so the asynchronous contract and cancel-before-start still hold.
 */
export function simulateInWorker(config: SimConfig, onProgress?: (done: number, total: number) => void): WorkerSimulation {
  let settled = false;
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rejectPromise: (reason: Error) => void = () => {};

  const cleanup = (): void => {
    settled = true;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const promise = new Promise<SimResult>((resolve, reject) => {
    rejectPromise = reject;
    const fail = (error: Error): void => {
      if (settled) return;
      cleanup();
      reject(error);
    };
    const succeed = (result: SimResult): void => {
      if (settled) return;
      cleanup();
      resolve(result);
    };

    if (typeof Worker === 'undefined') {
      timer = setTimeout(() => {
        timer = null;
        if (settled) return;
        try {
          succeed(runSimulation(config, onProgress));
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      }, 0);
      return;
    }

    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (!message || settled) return;
      switch (message.type) {
        case 'progress':
          onProgress?.(message.done, message.total);
          break;
        case 'done':
          succeed(message.result);
          break;
        case 'error':
          fail(new Error(message.message));
          break;
      }
    };
    worker.onerror = (event: ErrorEvent) => {
      fail(new Error(event.message || 'The simulation worker failed'));
    };
    const request: WorkerRequest = { type: 'run', config };
    worker.postMessage(request);
  });

  return {
    promise,
    cancel(): void {
      if (settled) return;
      cleanup();
      rejectPromise(new SimulationCancelledError());
    },
  };
}
