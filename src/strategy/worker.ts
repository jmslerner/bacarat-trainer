/// <reference lib="webworker" />
/**
 * Web Worker entry: runs `runSimulation` off the main thread and streams progress back.
 * Created by `simulateInWorker` as `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
 */
import { runSimulation } from './simulate';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;

function reply(message: WorkerResponse): void {
  scope.postMessage(message);
}

scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== 'run') return;
  try {
    const result = runSimulation(request.config, (done, total) => reply({ type: 'progress', done, total }));
    reply({ type: 'done', result });
  } catch (error) {
    reply({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
