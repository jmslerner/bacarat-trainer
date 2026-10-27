/**
 * NumberInput — a text field for numbers (money, odds, counts) with ±steppers, min/max
 * clamping on blur, thousands grouping when idle and free typing while focused.
 */
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';
import { Field } from './Field';
import fieldStyles from './Field.module.css';
import styles from './NumberInput.module.css';

export interface NumberInputProps {
  label?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places allowed (0 = integers only). Omit for any. */
  decimals?: number;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  size?: 'sm' | 'md';
  /** Show the − / + buttons (default true). */
  steppers?: boolean;
  /** Label beside the control instead of above. */
  inline?: boolean;
  /** Visible width in characters. */
  width?: number;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
}

function parse(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function clampRound(n: number, min: number | undefined, max: number | undefined, decimals: number | undefined): number {
  let out = n;
  if (decimals !== undefined) {
    const f = 10 ** decimals;
    out = Math.round(out * f) / f;
  }
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return out;
}

function idle(n: number, decimals: number | undefined): string {
  if (!Number.isFinite(n)) return '';
  const digits = decimals ?? (Number.isInteger(n) ? 0 : Math.min(4, (String(n).split('.')[1] ?? '').length));
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits, useGrouping: true }).format(n);
}

export function NumberInput({ label, value, onChange, min, max, step = 1, decimals, prefix, suffix, hint, error, disabled, id, name, size = 'md', steppers = true, inline, width, placeholder, className, ...rest }: NumberInputProps): ReactNode {
  const auto = useId();
  const inputId = id ?? `${auto}-num`;
  const hintId = `${auto}-hint`;
  const errorId = `${auto}-err`;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => idle(value, decimals));

  // Follow external value changes while not editing.
  useEffect(() => {
    if (!focused) setText(idle(value, decimals));
  }, [value, decimals, focused]);

  const invalid = Boolean(error) || (focused && parse(text) === null && text.trim() !== '');

  const commit = (n: number): void => {
    const next = clampRound(n, min, max, decimals);
    if (next !== value) onChange(next);
    setText(focused ? String(next) : idle(next, decimals));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = parse(text) ?? value;
      commit(base + (e.key === 'ArrowUp' ? step : -step));
    } else if (e.key === 'Enter') {
      const n = parse(text);
      if (n !== null) commit(n);
    }
  };

  const describedBy = error ? errorId : hint !== undefined ? hintId : undefined;
  // The steppers clamp to the bounds like the arrow keys do, so they stay usable until the bound is reached.
  const canDec = !disabled && (min === undefined || value > min + 1e-9);
  const canInc = !disabled && (max === undefined || value < max - 1e-9);

  return (
    <Field htmlFor={inputId} label={label} hint={hint} error={error} hintId={hintId} errorId={errorId} inline={inline} className={className}>
      <div className={cx(fieldStyles.box, size === 'sm' && fieldStyles.sm, disabled && fieldStyles.boxDisabled, styles.wrap)}>
        {steppers && (
          <button type="button" className={styles.step} tabIndex={-1} aria-label="Decrease" disabled={!canDec} onClick={() => commit(value - step)}>
            −
          </button>
        )}
        {prefix !== undefined && <span className={styles.affix}>{prefix}</span>}
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode={decimals === 0 ? 'numeric' : 'decimal'}
          autoComplete="off"
          className={styles.input}
          style={width ? { width: `${width}ch` } : undefined}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-label={rest['aria-label']}
          onFocus={() => {
            setFocused(true);
            setText(Number.isFinite(value) ? String(value) : '');
          }}
          onBlur={() => {
            setFocused(false);
            const n = parse(text);
            if (n === null) setText(idle(value, decimals));
            else {
              const next = clampRound(n, min, max, decimals);
              if (next !== value) onChange(next);
              setText(idle(next, decimals));
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            const n = parse(raw);
            if (n === null) return;
            // Free typing in the field, but the parent only ever sees a legal value:
            // clamped to [min, max] and rounded to `decimals` (the text is tidied on blur).
            const next = clampRound(n, min, max, decimals);
            if (next !== value) onChange(next);
          }}
          onKeyDown={onKeyDown}
        />
        {suffix !== undefined && <span className={styles.affix}>{suffix}</span>}
        {steppers && (
          <button type="button" className={styles.step} tabIndex={-1} aria-label="Increase" disabled={!canInc} onClick={() => commit(value + step)}>
            +
          </button>
        )}
      </div>
    </Field>
  );
}
