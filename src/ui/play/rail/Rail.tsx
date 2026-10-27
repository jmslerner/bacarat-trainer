/**
 * Rail — the mahogany rail in front of the player: chip tray, bankroll and limits plaques, the controls
 * (DEAL / REBET / CLEAR / UNDO / AUTO / speed / New shoe / Buy-in) and the notice line for errors.
 */
import type { ReactNode } from 'react';
import type { TableRules } from '@/engine';
import { Button, Chip, Plaque, Select, Tooltip, cx, formatMoney, DEAL_SPEEDS, type DealSpeed } from '@/ui/shell';
import type { Phase } from '../animation/types';
import styles from './Rail.module.css';

export interface Notice {
  id: number;
  text: string;
  tone: 'error' | 'info';
}

export interface RailProps {
  rules: TableRules;
  selectedChip: number;
  onSelectChip: (value: number) => void;
  /** Bankroll as displayed (animated during settlement). */
  bankroll: number;
  onLayout: number;
  /** Why dealing is not possible right now (null = can deal). */
  dealReason: string | null;
  busy: boolean;
  phase: Phase;
  auto: boolean;
  onToggleAuto: () => void;
  speed: DealSpeed;
  onSpeed: (speed: DealSpeed) => void;
  rebetAmount: number;
  hasBets: boolean;
  onDeal: () => void;
  onRebet: () => void;
  onClear: () => void;
  onUndo: () => void;
  onNewShoe: () => void;
  onBuyIn: () => void;
  notice: Notice | null;
  phone: boolean;
}

const SPEED_OPTIONS = DEAL_SPEEDS.map((s) => ({ value: s.id, label: s.label }));

export function Rail({ rules, selectedChip, onSelectChip, bankroll, onLayout, dealReason, busy, phase, auto, onToggleAuto, speed, onSpeed, rebetAmount, hasBets, onDeal, onRebet, onClear, onUndo, onNewShoe, onBuyIn, notice, phone }: RailProps): ReactNode {
  const chips = rules.chipDenominations;
  const canDeal = dealReason === null && !busy;
  const dealLabel = busy ? (phase === 'shuffling' ? 'Skip' : 'Fast forward') : 'Deal';
  const limitsSub = `Tie ${formatMoney(rules.limits.tie.min)}–${formatMoney(rules.limits.tie.max)} · Side ${formatMoney(rules.limits.side.min)}–${formatMoney(rules.limits.side.max)}`;

  return (
    <div className={cx(styles.rail, phone && styles.railPhone)} data-testid="rail">
      <div className={styles.top}>
        <div className={styles.tray} role="group" aria-label="Chip tray">
          {chips.map((value, i) => (
            <span key={value} className={styles.trayChip}>
              <Chip value={value} size={phone ? 34 : 44} selected={value === selectedChip} onClick={() => onSelectChip(value)} disabled={busy} data-testid={`chip-${value}`} label={`${formatMoney(value)} chip${value === selectedChip ? ' (selected)' : ''}`} />
              {i < 9 && !phone && (
                <kbd className={styles.trayKey} aria-hidden="true">
                  {i + 1}
                </kbd>
              )}
            </span>
          ))}
          <span className={styles.traySelected} aria-live="polite">
            <span className={styles.trayLabel}>In hand</span>
            <strong className="num">{formatMoney(selectedChip)}</strong>
          </span>
        </div>

        <div className={styles.plaques}>
          <Plaque size="sm" tone="ivory" sub={`On layout ${formatMoney(onLayout)}`} className={styles.bankrollPlaque} data-testid="table-bankroll">
            <span className={styles.bankrollValue} data-value={bankroll}>
              {formatMoney(bankroll)}
            </span>
          </Plaque>
          <Plaque size="sm" sub={limitsSub} className={styles.limitsPlaque}>
            Min {formatMoney(rules.limits.main.min)} — Max {formatMoney(rules.limits.main.max)}
          </Plaque>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.mainControls}>
          <Tooltip content={busy ? 'Skip the animation (Space)' : dealReason ?? 'Deal the hand (Space)'} placement="top">
            <Button variant="primary" size={phone ? 'md' : 'lg'} kbd="Space" onClick={onDeal} disabled={!busy && !canDeal} aria-disabled={!busy && !canDeal} className={styles.dealButton} data-testid="deal-button">
              {dealLabel}
            </Button>
          </Tooltip>
          <Button kbd="R" onClick={onRebet} disabled={busy || rebetAmount <= 0} data-testid="rebet-button" title={rebetAmount > 0 ? `Repeat the last bets (${formatMoney(rebetAmount)})` : 'No previous bets to repeat'}>
            Rebet{rebetAmount > 0 ? ` ${formatMoney(rebetAmount)}` : ''}
          </Button>
          <Button kbd="C" onClick={onClear} disabled={busy || !hasBets} data-testid="clear-button">
            Clear
          </Button>
          <Button kbd="U" onClick={onUndo} disabled={busy || !hasBets} data-testid="undo-button">
            Undo
          </Button>
          <Button kbd="A" onClick={onToggleAuto} active={auto} variant={auto ? 'danger' : 'secondary'} data-testid="auto-button" title={auto ? 'Stop auto-deal' : 'Auto: rebet and deal until stopped or the bankroll cannot cover the bets'}>
            {auto ? 'Stop auto' : 'Auto'}
          </Button>
        </div>
        <div className={styles.secondaryControls}>
          <Select<DealSpeed> aria-label="Dealing speed" value={speed} options={SPEED_OPTIONS} onChange={onSpeed} size="sm" inline className={styles.speed} />
          <Button size="sm" variant="ghost" onClick={onNewShoe} disabled={busy} data-testid="new-shoe-button">
            New shoe
          </Button>
          <Button size="sm" variant="ghost" onClick={onBuyIn} data-testid="buy-in-button">
            Buy-in
          </Button>
        </div>
      </div>

      <div className={styles.status}>
        {notice ? (
          <p key={notice.id} className={cx(styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeInfo)} role={notice.tone === 'error' ? 'alert' : 'status'} data-testid="notice">
            {notice.text}
          </p>
        ) : !busy && dealReason ? (
          <p className={styles.reason} data-testid="deal-reason">
            {dealReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
