import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { Field } from './Field';
import fieldStyles from './Field.module.css';
import styles from './Select.module.css';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  label?: ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  size?: 'sm' | 'md';
  inline?: boolean;
  'aria-label'?: string;
  className?: string;
}

/** A styled native <select> (keyboard and screen-reader behaviour for free). */
export function Select<T extends string = string>({ label, value, options, onChange, hint, error, disabled, id, name, size = 'md', inline, className, ...rest }: SelectProps<T>): ReactNode {
  const auto = useId();
  const selectId = id ?? `${auto}-sel`;
  const hintId = `${auto}-hint`;
  const errorId = `${auto}-err`;
  const describedBy = error ? errorId : hint !== undefined ? hintId : undefined;
  return (
    <Field htmlFor={selectId} label={label} hint={hint} error={error} hintId={hintId} errorId={errorId} inline={inline} className={className}>
      <div className={cx(fieldStyles.box, size === 'sm' && fieldStyles.sm, disabled && fieldStyles.boxDisabled, styles.wrap)}>
        <select
          id={selectId}
          name={name}
          className={styles.select}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-label={rest['aria-label']}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <svg className={styles.chevron} viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Field>
  );
}
