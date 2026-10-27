import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Field.module.css';

export interface FieldProps {
  /** id of the control the label points at. */
  htmlFor?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  hintId?: string;
  errorId?: string;
  /** Label beside the control instead of above it. */
  inline?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label / control / hint / error layout shared by the form controls. */
export function Field({ htmlFor, label, hint, error, hintId, errorId, inline, className, children }: FieldProps): ReactNode {
  return (
    <div className={cx(styles.field, inline && styles.inline, error && styles.hasError, className)}>
      {label !== undefined && (
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.control}>
        {children}
        {error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        ) : hint !== undefined ? (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
