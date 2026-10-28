/**
 * DealerBar — the dealer's calls (aria-live) with the optional beginner tip, plus the settlement status line.
 * The hit call ("Dragon 7!" / "Panda 8!") is set large in glowing gold or pearl; afterwards the hit stays on
 * as a badge beside the later calls (the cut card, the settlement).
 */
import type { ReactNode } from 'react';
import { cx } from '@/ui/shell';
import type { HandDisplay, Phase } from '../animation/types';
import styles from './Felt.module.css';

export interface DealerBarProps {
  hand: HandDisplay;
  phase: Phase;
  announce: string;
  showTips: boolean;
}

export function DealerBar({ hand, phase, announce, showTips }: DealerBarProps): ReactNode {
  const tone = hand.outcome === 'banker' ? styles.callBanker : hand.outcome === 'player' ? styles.callPlayer : hand.outcome === 'tie' ? styles.callTie : undefined;
  const bonus = hand.dragon7 ? 'dragon7' : hand.panda8 ? 'panda8' : null;
  const hit = hand.hit;
  return (
    <div className={cx(styles.dealer, phase === 'dealing' && styles.dealerActive)} data-phase={phase}>
      <div className={cx(styles.call, tone, hit && styles.callHitRow)} role="status" aria-live="polite" aria-atomic="true" data-testid="dealer-call">
        {bonus && !hit && (
          <span className={cx(styles.callBadge, bonus === 'dragon7' ? styles.callDragon : styles.callPanda)} aria-hidden="true">
            {bonus === 'dragon7' ? 'Dragon 7' : 'Panda 8'}
          </span>
        )}
        <span className={cx(styles.callText, hit && styles.callHit, hit === 'dragon7' && styles.callHitDragon, hit === 'panda8' && styles.callHitPanda)} data-hit={hit ?? undefined}>
          {hand.message}
        </span>
      </div>
      {showTips && hand.tip && (
        <p className={styles.tip} data-testid="dealer-tip">
          <span className={styles.tipLabel}>Why</span>
          {hand.tip}
        </p>
      )}
      <p className={cx(styles.announce, announce === '' && styles.announceEmpty)} role="status" aria-live="polite" data-testid="settlement-status">
        {announce}
      </p>
    </div>
  );
}
