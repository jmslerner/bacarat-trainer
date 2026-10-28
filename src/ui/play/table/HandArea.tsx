/**
 * HandArea — one side's card area on the felt: the painted name, the cards (third card sideways), the total.
 */
import type { ReactNode, RefObject } from 'react';
import type { Card, Outcome, Side } from '@/engine';
import { CARD_SIZES, PlayingCard, cx, type CardSize } from '@/ui/shell';
import { fitCardWidth } from './cardFit';
import { DealtCard } from './DealtCard';
import { useElementWidth } from './useElementWidth';
import styles from './Felt.module.css';

export interface HandAreaProps {
  side: Side;
  cards: readonly Card[];
  total: number | null;
  natural: boolean;
  outcome: Outcome | null;
  bonus: 'dragon7' | 'panda8' | null;
  pair: boolean;
  size: CardSize;
  dealMs: number;
  shoeRef: RefObject<HTMLElement>;
  /** This side's third card is revealed with the suspense flip. */
  reveal?: boolean;
  /** How long that card waits face down. */
  revealMs?: number;
}

const NAME: Record<Side, string> = { player: 'Player', banker: 'Banker' };

export function HandArea({ side, cards, total, natural, outcome, bonus, pair, size, dealMs, shoeRef, reveal = false, revealMs = 0 }: HandAreaProps): ReactNode {
  // The nominal size for the breakpoint, shrunk when the hand area is too narrow for a three-card hand.
  const [cardsRef, cardsBox] = useElementWidth<HTMLDivElement>();
  const cardWidth = fitCardWidth(cardsBox.width, cardsBox.gap, CARD_SIZES[size]);
  const won = outcome === side;
  const lost = outcome !== null && outcome !== 'tie' && outcome !== side;
  const tie = outcome === 'tie';
  const totalText = total === null ? '—' : String(total);
  const label = `${NAME[side]}: ${cards.length === 0 ? 'no cards' : `${cards.length} cards, total ${totalText}`}${won ? ', wins' : tie ? ', tie' : ''}`;

  return (
    <section className={cx(styles.hand, styles[side], won && styles.handWon, lost && styles.handLost, tie && styles.handTie, bonus === 'dragon7' && styles.handDragon, bonus === 'panda8' && styles.handPanda)} aria-label={label} data-side={side} data-total={total ?? ''} data-bonus={bonus ?? undefined}>
      <header className={styles.handHeader}>
        <h3 className={styles.handName}>{NAME[side]}</h3>
        {pair && (
          <span className={styles.handTag} data-tag="pair">
            Pair
          </span>
        )}
        {natural && (
          <span className={styles.handTag} data-tag="natural">
            Natural
          </span>
        )}
        {bonus === 'dragon7' && (
          <span className={cx(styles.handTag, styles.tagDragon)} data-tag="dragon7">
            Dragon 7
          </span>
        )}
        {bonus === 'panda8' && (
          <span className={cx(styles.handTag, styles.tagPanda)} data-tag="panda8">
            Panda 8
          </span>
        )}
      </header>
      <div ref={cardsRef} className={styles.cards} data-cards={cards.length} data-card-width={cardWidth}>
        {cards.length === 0 ? (
          <>
            <PlayingCard size={cardWidth} label="Empty card slot" />
            <PlayingCard size={cardWidth} label="Empty card slot" />
          </>
        ) : (
          cards.map((card, i) => (
            <DealtCard
              key={card.id}
              card={card}
              rotated={i === 2}
              size={cardWidth}
              shoeRef={shoeRef}
              dealMs={dealMs}
              revealMs={reveal && i === 2 ? revealMs : 0}
              highlight={won && outcome !== null && i === cards.length - 1 && bonus !== null}
              glow={bonus === null ? null : i === cards.length - 1 ? 'strong' : 'soft'}
            />
          ))
        )}
      </div>
      <div className={styles.totalWrap}>
        <span className={styles.totalLabel}>Total</span>
        <span className={cx(styles.total, total !== null && styles.totalShown)} aria-hidden="true">
          {totalText}
        </span>
        {won && <span className={styles.wins}>Wins</span>}
        {tie && <span className={styles.wins}>Tie</span>}
      </div>
    </section>
  );
}
