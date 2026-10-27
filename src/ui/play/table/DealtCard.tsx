/**
 * DealtCard — a card that slides in from the shoe and flips face up when it mounts.
 * Third cards are laid sideways. The slide origin is measured from the shoe element.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Card } from '@/engine';
import { PlayingCard, cx, type CardSize } from '@/ui/shell';
import styles from './Felt.module.css';

export interface DealtCardProps {
  card: Card;
  rotated?: boolean;
  size: CardSize | number;
  shoeRef: RefObject<HTMLElement>;
  highlight?: boolean;
  dimmed?: boolean;
  /** CSS duration of the slide/flip; 0 = no animation. */
  dealMs: number;
}

export function DealtCard({ card, rotated = false, size, shoeRef, highlight, dimmed, dealMs }: DealtCardProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  // Measure the distance from the shoe once, before the first paint, so the slide starts at the shoe.
  useLayoutEffect(() => {
    const el = ref.current;
    const shoe = shoeRef.current;
    if (!el || !shoe || dealMs <= 0) return;
    try {
      const a = el.getBoundingClientRect();
      const b = shoe.getBoundingClientRect();
      if (a.width === 0 || b.width === 0) return;
      el.style.setProperty('--dx', `${Math.round(b.left + b.width / 2 - (a.left + a.width / 2))}px`);
      el.style.setProperty('--dy', `${Math.round(b.top + b.height / 2 - (a.top + a.height / 2))}px`);
    } catch {
      /* measuring is cosmetic */
    }
    // The origin is only meaningful for the mount animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = { '--deal-ms': `${dealMs}ms` } as CSSProperties;
  return (
    <div ref={ref} className={cx(styles.cardFlip, dealMs > 0 && styles.cardAnimated, rotated && styles.cardRotated)} style={style} data-card-id={card.id} data-dealt>
      <div className={styles.cardFace}>
        <PlayingCard card={card} rotated={rotated} size={size} highlight={highlight} dimmed={dimmed} />
      </div>
      <div className={styles.cardBack} aria-hidden="true">
        <PlayingCard faceDown rotated={rotated} size={size} label="" />
      </div>
    </div>
  );
}
