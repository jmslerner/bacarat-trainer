/**
 * ShoeView — the dealing shoe: cards remaining, the shoe's depth with the cut-card marker, the exposed burn
 * card of the burn procedure and the "cut card out" state.
 */
import { forwardRef, type ReactNode } from 'react';
import type { ShoeInfo, TableRules } from '@/engine';
import { PlayingCard, cardShortLabel, cx, formatNumber } from '@/ui/shell';
import type { ShuffleDisplay } from '../animation/types';
import styles from './Felt.module.css';

export interface ShoeViewProps {
  shoe: ShoeInfo;
  rules: TableRules;
  shuffle: ShuffleDisplay | null;
  compact?: boolean;
}

export const ShoeView = forwardRef<HTMLDivElement, ShoeViewProps>(function ShoeView({ shoe, rules, shuffle, compact }, ref): ReactNode {
  const total = Math.max(1, shoe.totalCards);
  const dealtPct = Math.min(100, Math.max(0, (shoe.cardsDealt / total) * 100));
  const cutPct = Math.min(100, Math.max(0, ((total - rules.cutCardFromEnd) / total) * 100));
  const shuffling = shuffle !== null && shuffle.stage !== 'burn';
  const burnCard = shuffle ? (shuffle.stage === 'burn' ? shuffle.card : null) : shoe.exposedBurnCard;
  const burned = shuffle ? (shuffle.stage === 'burn' ? shuffle.burned : 0) : shoe.burnedCount;
  const cutPlaced = shuffle === null || shuffle.stage !== 'shuffling';
  const remainingText = `${formatNumber(shoe.cardsRemaining)} left`;
  const label = `Shoe ${shoe.shoeNumber}: ${remainingText} of ${shoe.totalCards}${shoe.cutCardReached ? ', cut card out' : ''}`;

  return (
    <div ref={ref} className={cx(styles.shoe, compact && styles.shoeCompact, shuffling && styles.shoeShuffling)} role="group" aria-label={label} data-shoe data-shoe-number={shoe.shoeNumber} data-remaining={shoe.cardsRemaining}>
      <div className={styles.shoeBody} aria-hidden="true">
        <span className={styles.shoeDeck} />
        <span className={styles.shoeDeck} />
        <span className={styles.shoeDeck} />
        <span className={styles.shoeLip} />
        {cutPlaced && <span className={styles.shoeCutCard} style={{ left: `${cutPct}%` }} title="Cut card" />}
      </div>
      <div className={styles.shoeText}>
        <span className={styles.shoeTitle}>Shoe {shoe.shoeNumber}</span>
        <span className={styles.shoeRemaining}>{remainingText}</span>
      </div>
      <div className={styles.depth} aria-hidden="true">
        <span className={styles.depthFill} style={{ width: `${dealtPct}%` }} />
        {cutPlaced && <span className={styles.depthCut} style={{ left: `${cutPct}%` }} />}
      </div>
      <div className={styles.shoeFooter}>
        {shoe.cutCardReached && !shuffling ? (
          <span className={styles.cutOut} data-cut-out>
            Cut card out
          </span>
        ) : burnCard && rules.burnProcedure ? (
          <span className={styles.burn} title={`Burn card ${cardShortLabel(burnCard)}: ${burned} cards burned face down`}>
            <PlayingCard card={burnCard} size={compact ? 22 : 28} label={`Exposed burn card ${cardShortLabel(burnCard)}`} className={styles.burnCard} />
            <span className={styles.burnText}>
              Burn {cardShortLabel(burnCard)} · {burned}
            </span>
          </span>
        ) : (
          <span className={styles.burnText}>{shuffling ? (shuffle.stage === 'shuffling' ? 'Shuffling…' : 'Cut card in') : rules.burnProcedure ? 'Burn —' : 'No burn'}</span>
        )}
      </div>
    </div>
  );
});
