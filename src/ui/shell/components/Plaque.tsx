import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Plaque.module.css';

export type PlaqueTone = 'gold' | 'ivory' | 'banker' | 'player' | 'tie';

export interface PlaqueProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'span' | 'h1' | 'h2' | 'h3' | 'p';
  size?: 'sm' | 'md' | 'lg';
  tone?: PlaqueTone;
  /** Engraved sub-line under the main text. */
  sub?: ReactNode;
  children: ReactNode;
}

/** A gold-framed engraved plaque: brand, table limits ("Min $10 — Max $5,000"), section titles. */
export function Plaque({ as = 'div', size = 'md', tone = 'gold', sub, className, children, ...rest }: PlaqueProps): ReactNode {
  return createElement(
    as,
    { className: cx(styles.plaque, styles[size], styles[tone], className), ...rest },
    <span className={styles.text}>{children}</span>,
    sub !== undefined ? <span className={styles.sub}>{sub}</span> : null,
  );
}
