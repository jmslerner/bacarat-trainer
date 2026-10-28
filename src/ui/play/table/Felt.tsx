/**
 * Felt — the painted table: card areas with totals, the shoe, the dealer bar, the Dragon 7 / Panda 8 band and the
 * bottom arc of betting spots (PLAYER PAIR · PLAYER · TIE · BANKER · BANKER PAIR), the commission box for the
 * classic rule and the "last hand of the shoe" banner.
 */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { BetType, Bets, ShoeInfo, Side, TableRules } from '@/engine';
import { limitsFor } from '@/engine';
import { cx, formatMoney, type CardSize } from '@/ui/shell';
import type { ChipStacks } from '../animation/timeline';
import type { Celebration, HandDisplay, LayoutDisplay, Phase, ShuffleDisplay } from '../animation/types';
import { BetSpot } from './BetSpot';
import { BonusCelebration } from './BonusCelebration';
import { DealerBar } from './DealerBar';
import { HandArea } from './HandArea';
import { ShoeView } from './ShoeView';
import { ARC_SPOTS, BAND_SPOTS, offeredSpots, spotNote, spotPayout, type SpotDef } from './spots';
import styles from './Felt.module.css';

export interface FeltProps {
  rules: TableRules;
  hand: HandDisplay;
  phase: Phase;
  shuffle: ShuffleDisplay | null;
  announce: string;
  shoe: ShoeInfo;
  dealMs: number;
  /** How long a squeezed third card waits face down (0 = ordinary flips). */
  revealMs?: number;
  /** The Dragon 7 / Panda 8 moment being shown. */
  celebration?: Celebration | null;
  /** Chips as dealt / settled; null shows the live layout. */
  layout: LayoutDisplay | null;
  liveBets: Bets;
  liveStacks: ChipStacks;
  selectedChip: number;
  /** Spots accept chips. */
  betting: boolean;
  showTips: boolean;
  /** Commission figures for the classic rule (null when not applicable). */
  commission: { thisHand: number; session: number } | null;
  phone: boolean;
  tablet: boolean;
  onAdd: (bet: BetType) => void;
  onRemove: (bet: BetType) => void;
}

export function Felt({ rules, hand, phase, shuffle, announce, shoe, dealMs, revealMs = 0, celebration = null, layout, liveBets, liveStacks, selectedChip, betting, showTips, commission, phone, tablet, onAdd, onRemove }: FeltProps): ReactNode {
  const shoeRef = useRef<HTMLDivElement>(null);
  const handsRef = useRef<HTMLDivElement>(null);
  const cardSize: CardSize = phone ? 'sm' : tablet ? 'md' : 'lg';
  const chipSize = phone ? 30 : tablet ? 36 : 42;
  const settling = phase === 'settling' || phase === 'settled';
  const arc = offeredSpots(ARC_SPOTS, rules);
  const band = offeredSpots(BAND_SPOTS, rules);
  const pairs = arc.filter((s) => s.bet === 'playerPair' || s.bet === 'bankerPair');
  const mains = arc.filter((s) => s.bet === 'player' || s.bet === 'tie' || s.bet === 'banker');
  // Phones: the pairs flank the Dragon 7 / Panda 8 band; the three main spots get the full width.
  const bandRow: SpotDef[] = phone ? [pairs[0], ...band, pairs[1]].filter((s): s is SpotDef => s !== undefined) : band;
  const arcRow: SpotDef[] = phone ? mains : arc;

  const renderSpot = (def: SpotDef, compact: boolean): ReactNode => {
    const snapshot = layout ? layout[def.bet] ?? null : null;
    const chips = layout ? snapshot?.chips ?? [] : liveStacks[def.bet] ?? [];
    const amount = layout ? snapshot?.amount ?? 0 : liveBets[def.bet] ?? 0;
    return (
      <BetSpot
        key={def.bet}
        def={def}
        payout={spotPayout(def.bet, rules)}
        note={spotNote(def.bet, rules)}
        chips={chips}
        amount={amount}
        display={snapshot}
        settling={settling}
        betting={betting}
        selectedChip={selectedChip}
        limits={limitsFor(def.bet, rules)}
        denominations={rules.chipDenominations}
        chipSize={chipSize}
        compact={compact}
        celebrate={celebration !== null && celebration.kind === def.bet}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    );
  };

  const lastHand = shoe.lastHandNext && phase !== 'shuffling';
  const bonusFor = (side: Side): 'dragon7' | 'panda8' | null => (side === 'banker' && hand.dragon7 ? 'dragon7' : side === 'player' && hand.panda8 ? 'panda8' : null);
  const squeezed = (side: Side): boolean => hand.reveal === side || hand.reveal === 'both';

  return (
    <div className={cx(styles.felt, phone && styles.feltPhone)} style={{ '--deal-ms': `${dealMs}ms` } as CSSProperties} data-phase={phase} data-testid="felt">
      <div className={styles.feltEdge} aria-hidden="true" />
      {lastHand && (
        <div className={styles.banner} role="status" data-testid="last-hand-banner">
          Last hand of the shoe
        </div>
      )}

      <div ref={handsRef} className={styles.hands}>
        <HandArea side="player" cards={hand.playerCards} total={hand.playerTotal} natural={hand.natural === 'player' || hand.natural === 'both'} outcome={hand.outcome} bonus={bonusFor('player')} pair={hand.playerPair} size={cardSize} dealMs={dealMs} shoeRef={shoeRef} reveal={squeezed('player')} revealMs={revealMs} faceDown={hand.faceDown === 'player'} />
        <HandArea side="banker" cards={hand.bankerCards} total={hand.bankerTotal} natural={hand.natural === 'banker' || hand.natural === 'both'} outcome={hand.outcome} bonus={bonusFor('banker')} pair={hand.bankerPair} size={cardSize} dealMs={dealMs} shoeRef={shoeRef} reveal={squeezed('banker')} revealMs={revealMs} faceDown={hand.faceDown === 'banker'} />
        <ShoeView ref={shoeRef} shoe={shoe} rules={rules} shuffle={shuffle} compact={phone} />
      </div>

      <DealerBar hand={hand} phase={phase} announce={announce} showTips={showTips} />

      {(bandRow.length > 0 || commission || rules.bankerRule === 'super6') && (
        <div className={cx(styles.band, phone && styles.bandPhone)} data-count={bandRow.length}>
          {bandRow.map((def) => renderSpot(def, phone))}
          {commission && (
            <div className={styles.commissionBox} role="group" aria-label="Commission box" data-testid="commission-box">
              <span className={styles.commissionTitle}>Commission {Math.round(rules.commissionRate * 100)}%</span>
              <span className={styles.commissionLine}>
                <span>This hand</span>
                <strong className="num">{formatMoney(commission.thisHand)}</strong>
              </span>
              <span className={styles.commissionLine}>
                <span>Session</span>
                <strong className="num">{formatMoney(commission.session)}</strong>
              </span>
            </div>
          )}
          {rules.bankerRule === 'super6' && (
            <div className={styles.commissionBox} role="note" data-testid="super6-box">
              <span className={styles.commissionTitle}>Super 6</span>
              <span className={styles.commissionLine}>Banker wins with 6 pay 1 to 2</span>
            </div>
          )}
        </div>
      )}

      <div className={cx(styles.arc, phone && styles.arcPhone)} data-count={arcRow.length}>
        <div className={styles.arcLine} aria-hidden="true" />
        {arcRow.map((def) => renderSpot(def, false))}
      </div>

      <BonusCelebration celebration={celebration} phone={phone} cardsRef={handsRef} />
    </div>
  );
}
