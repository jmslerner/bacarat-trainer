import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './components/Button';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Where the error happened, for the message ("the Play view"). */
  label?: string;
}

interface State {
  error: Error | null;
}

/** Keeps one broken view from taking the whole table down. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface in dev tools; the UI shows a friendly card.
    console.error('[Baccarat Trainer] view error', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className={styles.card} role="alert">
        <h2 className={styles.title}>Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}</h2>
        <p className={styles.message}>{error.message || String(error)}</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={this.reset}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Reload the app
          </Button>
        </div>
      </div>
    );
  }
}
