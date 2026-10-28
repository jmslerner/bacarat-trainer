/**
 * Beginner tips: a one-line, rule-based explanation for every dealer call in a hand
 * ("Player has 5: with 0–5 the Player must draw a third card.").
 *
 * Pure: walks `HandResult.steps` once, tracking the cards as they hit the felt, and returns one
 * explanation per step (null where nothing useful can be said).
 */
import { cardValue, rankLabel } from '@/engine';
import type { Card, DealStep, HandResult, TableRules } from '@/engine';

const SUIT_WORD: Readonly<Record<Card['suit'], string>> = { S: '♠', H: '♥', D: '♦', C: '♣' };

function label(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_WORD[card.suit]}`;
}

function valueWord(card: Card): string {
  const v = cardValue(card.rank);
  if (card.rank === 'A') return 'Ace counts 1';
  if (v === 0) return `${rankLabel(card.rank)} counts 0`;
  return `${rankLabel(card.rank)} counts ${v}`;
}

function sum(cards: readonly Card[]): number {
  return cards.reduce((s, c) => s + cardValue(c.rank), 0);
}

function twoCardLine(side: 'Player' | 'Banker', cards: readonly Card[]): string {
  const total = sum(cards);
  const mod = total % 10;
  const parts = cards.map(valueWord).join(', ');
  const tail = total >= 10 ? ` — ${total} counts as ${mod}, only the last digit matters` : '';
  return `${side} holds ${cards.map(label).join(' ')}: ${parts}, total ${mod}${tail}.`;
}

/** Banker's rule row for a two-card total when the Player drew. */
function bankerRow(bankerTotal: number): string {
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return 'Banker always draws on 0, 1 or 2';
    case 3:
      return 'on 3 Banker draws unless the Player’s third card is an 8';
    case 4:
      return 'on 4 Banker draws against a 2–7 and stands against 0, 1, 8 or 9';
    case 5:
      return 'on 5 Banker draws against a 4–7 and stands against 0–3, 8 or 9';
    case 6:
      return 'on 6 Banker draws only against a 6 or 7';
    default:
      return 'on 7 Banker always stands';
  }
}

function bankerPayLine(rules: TableRules): string {
  switch (rules.bankerRule) {
    case 'ez':
      return 'Banker bets pay 1:1 with no commission';
    case 'commission':
      return `Banker bets pay 1:1 minus ${Math.round(rules.commissionRate * 100)}% commission`;
    case 'super6':
      return 'Banker bets pay 1:1 (a winning Banker 6 pays only half)';
  }
}

/** One explanation per step of `result.steps`, in order. */
export function explainSteps(result: HandResult, rules: TableRules): Array<string | null> {
  const player: Card[] = [];
  const banker: Card[] = [];
  let playerTwo = 0;
  let bankerTwo = 0;
  let playerThird: Card | null = null;
  let playerStood = false;

  return result.steps.map((step: DealStep): string | null => {
    switch (step.type) {
      case 'deal': {
        const to = step.to === 'player' ? player : banker;
        to.push(step.card);
        if (step.index === 0 && step.to === 'player') {
          return 'Cards go Player, Banker, Player, Banker. Ace counts 1, 2–9 face value, 10s and face cards count 0.';
        }
        if (step.index === 0) return 'Banker’s first card. Suits never matter in baccarat — only the values.';
        if (step.index === 1) return twoCardLine(step.to === 'player' ? 'Player' : 'Banker', to);
        // Third card.
        const before = step.to === 'player' ? playerTwo : bankerTwo;
        const v = cardValue(step.card.rank);
        const after = (before + v) % 10;
        if (step.to === 'player') playerThird = step.card;
        return `${step.to === 'player' ? 'Player' : 'Banker'}’s third card is ${label(step.card)} (${valueWord(step.card)}): ${before} + ${v} → ${after}. Third cards are laid sideways.`;
      }
      case 'show':
        playerTwo = step.playerTotal;
        bankerTwo = step.bankerTotal;
        return 'Totals are called before any third card. A two-card 8 or 9 is a natural and ends the hand at once.';
      case 'natural':
        if (step.side === 'both') return 'Both hands are naturals: no more cards. The higher natural wins, equal naturals tie.';
        return step.side === 'player'
          ? `Player’s two-card ${playerTwo} is a natural: both hands stand and the hand is over.`
          : `Banker’s two-card ${bankerTwo} is a natural: the Player never draws against a natural, so the hand is over.`;
      case 'draw':
        if (step.side === 'player') return `Player has ${playerTwo}: with 0–5 the Player must draw a third card.`;
        if (playerStood) return `The Player stood, so Banker follows the Player rule: ${bankerTwo} is 0–5, so Banker draws.`;
        return `Banker has ${bankerTwo} and the Player’s third card was a ${playerThird ? cardValue(playerThird.rank) : '?'}: ${bankerRow(bankerTwo)}, so Banker draws.`;
      case 'stand':
        if (step.side === 'player') {
          playerStood = true;
          return `Player has ${playerTwo}: with 6 or 7 the Player stands.`;
        }
        if (playerStood) return `The Player stood, so Banker follows the Player rule: ${bankerTwo} is 6 or 7, so Banker stands.`;
        return `Banker has ${bankerTwo} and the Player’s third card was a ${playerThird ? cardValue(playerThird.rank) : '?'}: ${bankerRow(bankerTwo)}, so Banker stands.`;
      case 'result':
        if (step.outcome === 'banker') return `Banker ${step.bankerTotal} beats Player ${step.playerTotal}. ${bankerPayLine(rules)}; Player bets lose.`;
        if (step.outcome === 'player') return `Player ${step.playerTotal} beats Banker ${step.bankerTotal}. Player bets pay 1:1; Banker bets lose.`;
        return `Equal totals: a Tie. Player and Banker bets push (money back); Tie bets pay ${rules.tiePays}:1.`;
      case 'bonus':
        switch (step.kind) {
          case 'dragon7':
            if (rules.bankerRule !== 'ez') return `Banker won with a THREE-card 7 — the Dragon 7, paying ${rules.dragon7Pays}:1.`;
            return rules.sideBets.dragon7
              ? `Banker won with a THREE-card 7 — the Dragon 7. Dragon 7 bets pay ${rules.dragon7Pays}:1 and the Banker bet is a push: that push is how EZ Baccarat replaces the commission.`
              : 'Banker won with a THREE-card 7 — the Dragon 7. The Banker bet is a push: that push is how EZ Baccarat replaces the commission.';
          case 'panda8':
            return `Player won with a THREE-card 8 — the Panda 8, paying ${rules.panda8Pays}:1. A two-card 8 is a natural, not a Panda.`;
          case 'playerPair':
            return `Player’s first two cards share a rank: Player Pair pays ${rules.pairPays}:1 whatever the outcome.`;
          case 'bankerPair':
            return `Banker’s first two cards share a rank: Banker Pair pays ${rules.pairPays}:1 whatever the outcome.`;
        }
        return null;
      case 'cutCard':
        return 'The cut card came out: this hand is completed, one more hand is dealt, then the shoe is reshuffled.';
      default:
        return null;
    }
  });
}
