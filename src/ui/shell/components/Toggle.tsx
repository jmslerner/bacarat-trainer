import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
  name?: string;
  className?: string;
}

/** An accessible switch (native checkbox with role="switch"). */
export function Toggle({ checked, onChange, label, description, disabled, size = 'md', id, name, className }: ToggleProps): ReactNode {
  const auto = useId();
  const inputId = id ?? `${auto}-toggle`;
  const labelId = `${auto}-label`;
  const descId = `${auto}-desc`;
  return (
    <label htmlFor={inputId} className={cx(styles.toggle, styles[size], disabled && styles.disabled, className)}>
      <span className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description !== undefined && (
          <span id={descId} className={styles.description}>
            {description}
          </span>
        )}
      </span>
      <input
        id={inputId}
        name={name}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description !== undefined ? descId : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
