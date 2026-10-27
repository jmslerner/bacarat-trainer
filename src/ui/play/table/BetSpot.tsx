/**
 * BetSpot — one betting spot painted on the felt. Click adds the selected chip; right-click or a long press takes
 * the last chip back. While a hand is settled the spot shows the result: payout chips on a winner, a PUSH badge,
 * losing chips swept to the dealer.
 */
import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { BetLimits, BetType } from '@/engine';
import { ChipStack, cx, formatMoney } from '@/ui/shell';
import type { SpotDisplay } from '../animation/types';
import type { SpotDef } from './spots';
import styles from './Felt.module.css';

export interface BetSpotProps {
  def: SpotDef;
  payout: string;
  note: string | null;
  /** Chips on the spot (live or snapshot), bottom first. */
  chips: readonly number[];
  amount: number;
  /** Settlement display when the hand is settled / being settled. */
  display: SpotDisplay | null;
  settling: boolean;
  /** Betting is open (spots accept chips). */
  betting: boolean;
  selectedChip: number;
  limits: BetLimits;
  denominations: readonly number[];
  chipSize: number;
  compact: boolean;
  onAdd: (bet: BetType) => void;
  onRemove: (bet: BetType) => void;
}

const LONG_PRESS_MS = 520;

export function BetSpot({ def, payout, note, chips, amount, display, settling, betting, selectedChip, limits, denominations, chipSize, compact, onAdd, onRemove }: BetSpotProps): ReactNode {
  const pressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const clearPress = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!betting || e.button !== 0) return;
      clearPress();
      pressTimer.current = window.setTimeout(() => {
        pressTimer.current = null;
        suppressClick.current = true;
        onRemove(def.bet);
      }, LONG_PRESS_MS);
    },
    [betting, clearPress, def.bet, onRemove],
  );

  const onClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onAdd(def.bet);
  }, [def.bet, onAdd]);

  const result = display?.result ?? null;
  const swept = display?.swept ?? false;
  const win = result === 'win';
  const lose = result === 'lose';
  const push = result === 'push';
  const payoutAmount = display && win ? display.net : 0;
  const stateText = amount > 0 ? `${formatMoney(amount)} on it` : 'no bet';
  const resultText = win ? `, won ${formatMoney(payoutAmount)}` : lose ? ', lost' : push ? ', push' : '';
  const hint = betting ? `. Click to add a ${formatMoney(selectedChip)} chip, right-click to take one back. Limits ${formatMoney(limits.min)} to ${formatMoney(limits.max)}` : '';
  const ariaLabel = `${def.label}: ${stateText}${resultText}${hint}`;

  return (
    <button
      type="button"
      className={cx(styles.spot, styles[`tone-${def.tone}`], amount > 0 && styles.spotActive, win && styles.spotWin, lose && styles.spotLose, push && styles.spotPush, !betting && styles.spotClosed, compact && styles.spotCompact)}
      data-bet={def.bet}
      data-amount={amount}
      data-result={result ?? undefined}
      disabled={!betting}
      aria-disabled={!betting}
      aria-label={ariaLabel}
      title={betting ? `${def.label} · ${payout}${note ? ` · ${note}` : ''} · min ${formatMoney(limits.min)}, max ${formatMoney(limits.max)}` : undefined}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        if (betting) onRemove(def.bet);
      }}
      onPointerDown={onPointerDown}
      onPointerUp={clearPress}
      onPointerLeave={clearPress}
      onPointerCancel={clearPress}
    >
      <span className={styles.spotName}>
        <span className={styles.spotNameLong}>{def.label}</span>
        <span className={styles.spotNameShort}>{def.short}</span>
      </span>
      <span className={styles.spotPays}>{payout}</span>
      {note && <span className={styles.spotNote}>{note}</span>}
      {def.key && !compact && (
        <kbd className={styles.spotKey} aria-hidden="true">
          {def.key}
        </kbd>
      )}
      <span className={styles.spotChips} aria-hidden="true">
        {chips.length > 0 && !swept && (
          <ChipStack chips={chips} size={chipSize} showTotal className={cx(styles.stack, settling && lose && styles.stackLosing, push && styles.stackPush)} />
        )}
        {win && payoutAmount > 0 && (
          <ChipStack amount={payoutAmount} denominations={denominations} size={chipSize} className={cx(styles.stack, styles.stackPayout)} maxVisible={8}>
            <span className={styles.payoutBadge}>+{formatMoney(payoutAmount)}</span>
          </ChipStack>
        )}
      </span>
      {result && (
        <span className={cx(styles.resultBadge, styles[`badge-${result}`])} aria-hidden="true">
          {win ? 'Win' : lose ? 'Lose' : 'Push'}
        </span>
      )}
    </button>
  );
}
