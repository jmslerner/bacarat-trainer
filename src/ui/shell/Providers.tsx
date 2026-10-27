import { useState, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { getSession } from './hooks/useSession';

export interface ProvidersProps {
  children: ReactNode;
}

/**
 * Mount point for shell-wide state. The shell keeps its shared state in module singletons
 * (settings stores, the GameSession, the sound engine) so hooks work anywhere — Providers
 * guarantees the session and its settings bridge are initialised before children render and
 * wraps them in an error boundary. Other modules can mount their view standalone with
 * `<Providers><PlayView /></Providers>` in a dev harness.
 */
export function Providers({ children }: ProvidersProps): ReactNode {
  useState(() => getSession());
  return <ErrorBoundary label="the app">{children}</ErrorBoundary>;
}
