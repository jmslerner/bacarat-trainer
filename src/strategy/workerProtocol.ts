import type { SimConfig, SimResult } from './types';

/** Main thread → worker. */
export type WorkerRequest = { type: 'run'; config: SimConfig };

/** Worker → main thread. */
export type WorkerResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; result: SimResult }
  | { type: 'error'; message: string };
