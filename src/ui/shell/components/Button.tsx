import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'banker' | 'player' | 'tie';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = gold (the main action, e.g. DEAL); secondary = ivory outline; ghost = text only. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  /** Square button that only shows `icon`; pass `aria-label`. */
  iconOnly?: boolean;
  /** Pressed/toggled look (also sets aria-pressed). */
  active?: boolean;
  /** Keyboard shortcut hint rendered as a small key cap. */
  kbd?: string;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, icon, iconRight, iconOnly, active, kbd, loading, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, styles[variant], styles[size], block && styles.block, iconOnly && styles.iconOnly, active && styles.active, loading && styles.loading, className)}
      aria-pressed={active !== undefined ? active : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {!iconOnly && children !== undefined && <span className={styles.label}>{children}</span>}
      {iconOnly && children !== undefined && <span className="sr-only">{children}</span>}
      {iconRight && (
        <span className={styles.icon} aria-hidden="true">
          {iconRight}
        </span>
      )}
      {kbd && !iconOnly && (
        <kbd className={styles.kbd} aria-hidden="true">
          {kbd}
        </kbd>
      )}
    </button>
  );
});
