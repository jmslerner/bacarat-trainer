import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Plaque.module.css';

export type PlaqueTone = 'gold' | 'ivory' | 'banker' | 'player' | 'tie';

export interface PlaqueProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'span' | 'h1' | 'h2' | 'h3' | 'p';
  size?: 'sm' | 'md' | 'lg';
  tone?: PlaqueTone;
  /** Engraved line above the main text (the table level on the limits plaque). */
  kicker?: ReactNode;
  /** Engraved sub-line under the main text. */
  sub?: ReactNode;
  children: ReactNode;
}

/** A gold-framed engraved plaque: brand, table limits ("$500 high-limit salon" / "Min $500 — Max $100,000"), section titles. */
export function Plaque({ as = 'div', size = 'md', tone = 'gold', kicker, sub, className, children, ...rest }: PlaqueProps): ReactNode {
  return createElement(
    as,
    { className: cx(styles.plaque, styles[size], styles[tone], className), ...rest },
    kicker !== undefined ? <span className={styles.kicker}>{kicker}</span> : null,
    <span className={styles.text}>{children}</span>,
    sub !== undefined ? <span className={styles.sub}>{sub}</span> : null,
  );
}
