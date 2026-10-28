/**
 * DealtCard — a card that slides in from the shoe and flips face up when it mounts. Third cards are laid
 * sideways. The slide origin is measured from the shoe element.
 *
 * With `revealMs` the card is the one that makes a Dragon 7 / Panda 8: it slides in face down, waits under the
 * drum roll and only then turns (the outer element slides, the inner one flips, so the two animations never fight
 * over `transform`). A fast-forward drops `revealMs` to 0 and the card snaps face up. `glow` is the celebration's
 * light on the winning hand: soft on every card, strong on the one that made it.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
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
  /** Suspense reveal: the card lies face down this long before it flips (0 = the ordinary flip). */
  revealMs?: number;
  /** Celebration glow. */
  glow?: 'soft' | 'strong' | null;
}

type Mode = 'static' | 'deal' | 'suspense';

export function DealtCard({ card, rotated = false, size, shoeRef, highlight, dimmed, dealMs, revealMs = 0, glow = null }: DealtCardProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  // How the card arrives is decided once, when it lands: later renders never replay the slide.
  const [mode] = useState<Mode>(() => (dealMs <= 0 ? 'static' : revealMs > 0 ? 'suspense' : 'deal'));
  const waiting = mode === 'suspense' && revealMs > 0;

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

  const style = { '--deal-ms': `${dealMs}ms`, '--reveal-ms': `${revealMs}ms` } as CSSProperties;
  return (
    <div
      ref={ref}
      className={cx(styles.cardFlip, mode === 'deal' && styles.cardAnimated, waiting && styles.cardSuspense, mode === 'suspense' && !waiting && styles.cardSnapped, glow === 'soft' && styles.cardGlow, glow === 'strong' && styles.cardGlowStrong)}
      style={style}
      data-card-id={card.id}
      data-dealt
      data-reveal={waiting || undefined}
      data-glow={glow ?? undefined}
    >
      <div className={styles.cardInner}>
        <div className={styles.cardFace}>
          <PlayingCard card={card} rotated={rotated} size={size} highlight={highlight} dimmed={dimmed} />
        </div>
        <div className={styles.cardBack} aria-hidden="true">
          <PlayingCard faceDown rotated={rotated} size={size} label="" />
        </div>
      </div>
    </div>
  );
}
