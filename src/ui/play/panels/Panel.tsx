import { useId, type ReactNode } from 'react';
import { cx } from '@/ui/shell';
import styles from './Panels.module.css';

export interface PanelProps {
  title: string;
  meta?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}

/** A collapsible side panel with a Cinzel title. */
export function Panel({ title, meta, open, onToggle, children, className, testId }: PanelProps): ReactNode {
  const id = useId();
  return (
    <section className={cx(styles.panel, className)} aria-labelledby={`${id}-title`} data-testid={testId}>
      <button type="button" className={styles.panelHeader} aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
        <h2 id={`${id}-title`} className={styles.panelTitle}>
          {title}
        </h2>
        {meta !== undefined && <span className={styles.panelMeta}>{meta}</span>}
        <svg className={styles.chevron} viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div id={`${id}-body`} className={styles.panelBody}>
          {children}
        </div>
      )}
    </section>
  );
}
