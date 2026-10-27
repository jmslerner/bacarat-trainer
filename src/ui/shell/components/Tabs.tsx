import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Tabs.module.css';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  size?: 'sm' | 'md';
  variant?: 'underline' | 'pill';
  /** Stretch tabs to fill the row. */
  fill?: boolean;
  className?: string;
  /** Panel content for the active tab; rendered with role="tabpanel" wired to the tab. */
  children?: ReactNode;
  panelClassName?: string;
}

export function Tabs<T extends string = string>({ items, value, onChange, label, size = 'md', variant = 'underline', fill, className, children, panelClassName }: TabsProps<T>): ReactNode {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabId = (id: T): string => `${base}-tab-${id}`;
  const panelId = (id: T): string => `${base}-panel-${id}`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const enabled = items.filter((t) => !t.disabled);
    const idx = enabled.findIndex((t) => t.id === value);
    if (enabled.length === 0) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = enabled[next];
    onChange(target.id);
    listRef.current?.querySelector<HTMLElement>(`[id="${tabId(target.id)}"]`)?.focus();
  };

  return (
    <>
      <div ref={listRef} role="tablist" aria-label={label} className={cx(styles.list, styles[variant], styles[size], fill && styles.fill, className)} onKeyDown={onKeyDown}>
        {items.map((t) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={selected}
              aria-controls={children !== undefined ? panelId(t.id) : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              className={cx(styles.tab, selected && styles.selected)}
              onClick={() => onChange(t.id)}
            >
              {t.icon && (
                <span className={styles.icon} aria-hidden="true">
                  {t.icon}
                </span>
              )}
              <span className={styles.label}>{t.label}</span>
              {t.badge !== undefined && <span className={styles.badge}>{t.badge}</span>}
            </button>
          );
        })}
      </div>
      {children !== undefined && (
        <div role="tabpanel" id={panelId(value)} aria-labelledby={tabId(value)} tabIndex={0} className={cx(styles.panel, panelClassName)}>
          {children}
        </div>
      )}
    </>
  );
}
