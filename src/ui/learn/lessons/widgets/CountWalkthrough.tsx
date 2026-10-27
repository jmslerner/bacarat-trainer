/**
 * A counting walkthrough: cards come out of the shoe one at a time (the exposed burn card first) and the
 * running count, decks remaining and true count update for the chosen system.
 */
import { useState, type ReactNode } from 'react';
import { cardValue, type Card, type Rank, type Suit } from '@/engine';
import { Button, PlayingCard, cx, formatNumber, formatSigned } from '@/ui/shell';
import { Facts, Widget } from '../components';
import type { CountSystemShape } from '../countingData';
import styles from './Widgets.module.css';

const RANK_SEQ: readonly Rank[] = ['7', '8', 'K', '4', '9', '5', 'A', '9', '8', '6', '2', 'T', '8', '9', '3', '7', '8', 'Q'];
const SUITS: readonly Suit[] = ['D', 'S', 'H', 'C'];
const CARDS: readonly Card[] = RANK_SEQ.map((rank, i) => ({ rank, suit: SUITS[i % SUITS.length], id: i }));

type Position = 'start' | 'middle' | 'late';
const POSITIONS: Record<Position, { label: string; cardsRemaining: number }> = {
  start: { label: 'Start of the shoe', cardsRemaining: 416 },
  middle: { label: 'Half-way', cardsRemaining: 208 },
  late: { label: 'Two decks left', cardsRemaining: 104 },
};

export interface CountWalkthroughProps {
  systems: { dragon7: CountSystemShape; panda8: CountSystemShape };
}

export function tagClass(tag: number): string {
  return tag > 0 ? styles.tagPos : tag < 0 ? styles.tagNeg : styles.tagZero;
}

export function CountWalkthrough({ systems }: CountWalkthroughProps): ReactNode {
  const [seen, setSeen] = useState(0);
  const [key, setKey] = useState<'dragon7' | 'panda8'>('dragon7');
  const [position, setPosition] = useState<Position>('start');
  const system = systems[key];
  const tags = system.tags;
  const running = CARDS.slice(0, seen).reduce((sum, c) => sum + tags[cardValue(c.rank)], 0);
  const cardsRemaining = POSITIONS[position].cardsRemaining - seen;
  const decks = cardsRemaining / 52;
  const trueCount = running / Math.max(decks, 0.5);
  const favourable = trueCount >= system.threshold;

  return (
    <Widget
      title="Keeping the count"
      hint="Deal cards from the shoe and watch the running and true counts."
      data-widget="count-walkthrough"
      actions={
        <div className={styles.choices} role="group" aria-label="Count system">
          <Button size="sm" variant="ghost" active={key === 'dragon7'} onClick={() => setKey('dragon7')}>
            Dragon 7 count
          </Button>
          <Button size="sm" variant="ghost" active={key === 'panda8'} onClick={() => setKey('panda8')}>
            Panda 8 count
          </Button>
        </div>
      }
    >
      <div className={styles.choiceGroup}>
        <span className={styles.choiceLabel} id="cw-pos-label">
          Where in the shoe
        </span>
        <div className={styles.choices} role="radiogroup" aria-labelledby="cw-pos-label">
          {(Object.keys(POSITIONS) as Position[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={position === p} className={styles.choice} style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)' }} onClick={() => setPosition(p)}>
              {POSITIONS[p].label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.countStrip} role="list" aria-label="Cards dealt">
        {CARDS.map((c, i) => {
          const tag = tags[cardValue(c.rank)];
          const isSeen = i < seen;
          return (
            <div key={c.id} className={styles.countCard} role="listitem">
              <PlayingCard card={isSeen ? c : null} faceDown={!isSeen} size="xs" highlight={i === seen - 1} label={isSeen ? undefined : 'Card still in the shoe'} />
              <span className={cx(styles.countTag, isSeen ? tagClass(tag) : styles.tagZero)} aria-hidden="true">
                {isSeen ? (i === 0 ? `burn ${formatSigned(tag)}` : formatSigned(tag)) : '·'}
              </span>
            </div>
          );
        })}
      </div>
      <Facts
        items={[
          { label: 'Cards seen', value: String(seen), sub: seen > 0 ? 'exposed burn card included' : 'press Next card' },
          { label: 'Running count', value: formatSigned(running), tone: running > 0 ? 'positive' : running < 0 ? 'negative' : 'neutral' },
          { label: 'Decks remaining', value: formatNumber(decks, 2), sub: `${cardsRemaining} cards` },
          { label: 'True count', value: formatSigned(trueCount, 1), sub: `running ÷ max(decks, ½)`, tone: favourable ? 'positive' : 'gold' },
          { label: `Bet ${key === 'dragon7' ? 'Dragon 7' : 'Panda 8'}?`, value: favourable ? 'Yes' : 'No', sub: `needs true count ≥ ${formatSigned(system.threshold)}`, tone: favourable ? 'positive' : 'neutral' },
        ]}
      />
      <div className={styles.controls}>
        <Button size="sm" variant="primary" onClick={() => setSeen((n) => Math.min(CARDS.length, n + 1))} disabled={seen >= CARDS.length}>
          Next card
        </Button>
        <Button size="sm" onClick={() => setSeen((n) => Math.max(0, n - 1))} disabled={seen === 0}>
          Back
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSeen(CARDS.length)} disabled={seen >= CARDS.length}>
          Deal all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSeen(0)} disabled={seen === 0}>
          Reset
        </Button>
      </div>
      <p className={styles.note}>
        The same running count means more late in the shoe: dividing by the decks still to come turns it into the true count, which is what the betting
        threshold refers to. Face-down burned cards are never counted — you did not see them.
      </p>
    </Widget>
  );
}
