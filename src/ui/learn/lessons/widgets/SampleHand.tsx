/**
 * Step-through hands: the cards appear one at a time with the dealer's call for each step (the engine's own
 * `HandResult.steps`) and a beginner's explanation of why the rules did what they did.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { cardValue, dealFromValues, type Card, type CardSpec, type DealStep, type HandResult, type TableRules } from '@/engine';
import { Button, cx } from '@/ui/shell';
import { HandCards, HandsRow, Widget } from '../components';
import { explainThirdCard } from '../thirdCardLogic';
import styles from './Widgets.module.css';

export interface SampleHandSpec {
  id: string;
  label: string;
  player: readonly CardSpec[];
  banker: readonly CardSpec[];
  /** Shown before the first card is dealt. */
  intro?: string;
}

export interface SampleHandProps {
  hands: readonly SampleHandSpec[];
  rules: TableRules;
  title?: ReactNode;
  hint?: ReactNode;
}

interface Snapshot {
  playerCards: Card[];
  bankerCards: Card[];
  playerTotal: number | null;
  bankerTotal: number | null;
}

function snapshotAt(steps: readonly DealStep[], index: number): Snapshot {
  const playerCards: Card[] = [];
  const bankerCards: Card[] = [];
  let shown = false;
  for (let i = 0; i <= index && i < steps.length; i++) {
    const s = steps[i];
    if (s.type === 'deal') (s.to === 'player' ? playerCards : bankerCards).push(s.card);
    if (s.type === 'show') shown = true;
  }
  const total = (cards: Card[]): number => cards.reduce((sum, c) => sum + cardValue(c.rank), 0) % 10;
  return { playerCards, bankerCards, playerTotal: shown ? total(playerCards) : null, bankerTotal: shown ? total(bankerCards) : null };
}

const ORDINAL = ['First', 'Second', 'Third'];

/** The beginner's one-line explanation for a step. */
export function explainStep(step: DealStep, result: HandResult, rules: TableRules): string {
  const show = result.steps.find((s): s is Extract<DealStep, { type: 'show' }> => s.type === 'show');
  const twoCardPlayer = show?.playerTotal ?? result.playerTotal;
  const twoCardBanker = show?.bankerTotal ?? result.bankerTotal;
  const p3 = result.playerCards.length === 3 ? cardValue(result.playerCards[2].rank) : null;
  const side = (s: 'player' | 'banker'): string => (s === 'player' ? 'Player' : 'Banker');

  switch (step.type) {
    case 'deal':
      if (step.index === 2) return `The ${side(step.to)}’s third card is placed sideways across the first two, as dealers do.`;
      return `${ORDINAL[step.index]} card to the ${side(step.to)}. Cards go Player, Banker, Player, Banker.`;
    case 'show': {
      const arith = (cards: Card[], total: number): string => {
        const vals = cards.map((c) => cardValue(c.rank));
        const sum = vals.reduce((a, b) => a + b, 0);
        return sum >= 10 ? `${vals.join(' + ')} = ${sum} → ${total}` : `${vals.join(' + ')} = ${total}`;
      };
      return `Add the card values and keep only the last digit. Player: ${arith(result.playerCards.slice(0, 2), step.playerTotal)}. Banker: ${arith(result.bankerCards.slice(0, 2), step.bankerTotal)}.`;
    }
    case 'natural':
      return 'An 8 or 9 on the first two cards is a natural. Nobody draws — the hand is decided on these four cards.';
    case 'draw':
    case 'stand': {
      const ex = explainThirdCard(twoCardPlayer, twoCardBanker, step.side === 'banker' ? p3 : null);
      if (step.side === 'player') return ex.lines[0];
      if (p3 === null) return ex.lines[1];
      return `${ex.bankerRule} ${ex.lines[2] ?? ''}`.trim();
    }
    case 'result':
      if (step.outcome === 'tie') return `Equal totals: a tie. Player and Banker bets are returned; Tie bets pay ${rules.tiePays} to 1.`;
      if (step.outcome === 'banker' && result.dragon7 && rules.bankerRule === 'ez') {
        return 'The hand closer to 9 wins — but the Banker made its 7 with three cards, so at an EZ table Banker bets are a push, not a win (next call); Player bets are collected.';
      }
      if (step.outcome === 'banker' && result.bankerWinOn6 && rules.bankerRule === 'super6') {
        return 'The hand closer to 9 wins. The Banker won with a 6, so at a Super 6 table Banker bets are paid only half (1 to 2); Player bets are collected.';
      }
      return `The hand closer to 9 wins. ${side(step.outcome)} bets are paid 1 to 1${step.outcome === 'banker' && rules.bankerRule === 'commission' ? ` less the ${Math.round(rules.commissionRate * 100)}% commission` : ''}; bets on the other side are collected.`;
    case 'bonus':
      switch (step.kind) {
        case 'dragon7':
          return `The Banker won with a THREE-card total of 7 — the Dragon 7.${rules.bankerRule === 'ez' ? ' At an EZ table every Banker bet is a push (returned, not paid).' : ''}${rules.sideBets.dragon7 ? ` The Dragon 7 side bet pays ${rules.dragon7Pays} to 1.` : ''}`;
        case 'panda8':
          return `The Player won with a THREE-card total of 8 — the Panda 8. The Panda 8 side bet pays ${rules.panda8Pays} to 1; Player bets are paid as usual.`;
        case 'playerPair':
          return `The Player’s first two cards share a rank: Player Pair pays ${rules.pairPays} to 1, whatever happens next.`;
        case 'bankerPair':
          return `The Banker’s first two cards share a rank: Banker Pair pays ${rules.pairPays} to 1, whatever happens next.`;
      }
      break;
    case 'cutCard':
      return 'The cut card came out during this hand: the dealer finishes it, deals one more hand, and then shuffles a new shoe.';
  }
  return '';
}

export function SampleHand({ hands, rules, title = 'A hand, step by step', hint = 'Press Deal, then Next for each dealer call.' }: SampleHandProps): ReactNode {
  const [handId, setHandId] = useState(hands[0]?.id ?? '');
  const [index, setIndex] = useState(-1);
  const spec = hands.find((h) => h.id === handId) ?? hands[0];
  const result = useMemo(() => dealFromValues(spec.player, spec.banker, rules), [spec, rules]);
  const steps = result.steps;
  const snap = snapshotAt(steps, index);
  const step = index >= 0 && index < steps.length ? steps[index] : null;
  const atEnd = index >= steps.length - 1;
  const bonus = step?.type === 'bonus' || step?.type === 'natural';

  const pick = (id: string): void => {
    setHandId(id);
    setIndex(-1);
  };

  return (
    <Widget
      title={title}
      hint={hint}
      data-widget="sample-hand"
      actions={
        hands.length > 1 ? (
          <div className={styles.choices} role="group" aria-label="Example hands">
            {hands.map((h) => (
              <Button key={h.id} size="sm" variant="ghost" active={h.id === spec.id} onClick={() => pick(h.id)}>
                {h.label}
              </Button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className={styles.felt}>
        <HandsRow>
          <HandCards side="player" cards={snap.playerCards} total={snap.playerTotal} slots={2} highlightIndex={step?.type === 'deal' && step.to === 'player' ? step.index : undefined} />
          <HandCards side="banker" cards={snap.bankerCards} total={snap.bankerTotal} slots={2} highlightIndex={step?.type === 'deal' && step.to === 'banker' ? step.index : undefined} />
        </HandsRow>
        <div className={styles.dealerBar} aria-live="polite" data-dealer-bar>
          <span className={cx(styles.dealerCall, bonus && styles.dealerCallBonus)}>{step ? step.message : spec.intro ?? 'Place your bets… no more bets.'}</span>
          <span className={styles.dealerTip}>{step ? explainStep(step, result, rules) : 'The dealer deals once the bets are down. You make no decisions from here on.'}</span>
        </div>
      </div>
      <div className={styles.controls}>
        <Button size="sm" variant="primary" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))} disabled={atEnd}>
          {index < 0 ? 'Deal' : 'Next'}
        </Button>
        <Button size="sm" onClick={() => setIndex((i) => Math.max(-1, i - 1))} disabled={index < 0}>
          Back
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIndex(-1)} disabled={index < 0}>
          Restart
        </Button>
        <span className={styles.spacer} />
        <div className={styles.stepMeter} aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={cx(styles.stepDot, i < index && styles.stepDotDone, i === index && styles.stepDotCurrent)} />
          ))}
        </div>
        <span className={styles.note} aria-live="polite">
          {index < 0 ? `${steps.length} steps` : `Step ${index + 1} of ${steps.length}`}
        </span>
      </div>
    </Widget>
  );
}
