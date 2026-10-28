import type { BonusKind } from '../bonus';
import { BonusBadge, cls } from './symbols';
import styles from './roads.module.css';

export interface BonusMedallionProps {
  kind: BonusKind;
  /** Rendered size in CSS pixels (default 16). */
  size?: number;
  /** Accessible name and tooltip; without one the icon is decorative (`aria-hidden`). */
  title?: string;
  className?: string;
}

/** The Dragon 7 (gold "7") or Panda 8 (pearl-ringed "8") medallion as an inline icon for HTML contexts. */
export function BonusMedallion({ kind, size = 16, title, className }: BonusMedallionProps) {
  const decorative = title === undefined;
  return (
    <svg
      className={cls(styles.medalIcon, className)}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
      data-medallion-icon={kind}
    >
      {!decorative && <title>{title}</title>}
      <BonusBadge kind={kind} cx={10} cy={10} r={9.2} outline={false} sheen />
    </svg>
  );
}
