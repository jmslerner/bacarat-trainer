/**
 * Lesson 1 — The Basics: object of the game, table tour, card values, a hand step by step.
 */
import type { ReactNode } from 'react';
import { exactProbabilities } from '@/engine';
import { formatPercent, useSettings } from '@/ui/shell';
import { Callout, Facts, HandCards, HandsRow, LessonLink, LessonPage, Prose, Section, Table, tableClass } from './components';
import { CardValueQuiz } from './widgets/CardValueQuiz';
import { SampleHand, type SampleHandSpec } from './widgets/SampleHand';
import { TableTour } from './widgets/TableTour';

const SECTIONS = [
  { id: 'object', title: 'The object of the game' },
  { id: 'layout', title: 'A tour of the table' },
  { id: 'values', title: 'Card values and totals' },
  { id: 'deal', title: 'How a hand is dealt' },
  { id: 'winning', title: 'Who wins and what you are paid' },
  { id: 'glossary', title: 'Words you will hear' },
] as const;

const HANDS: readonly SampleHandSpec[] = [
  { id: 'typical', label: 'Both draw', player: [3, 2, 4], banker: [5, 'K', 2], intro: 'A typical hand: both sides end up taking a third card.' },
  { id: 'natural', label: 'Natural', player: ['K', 8], banker: [4, 3], intro: 'When a natural lands, the hand is over after four cards.' },
  { id: 'stand', label: 'Player stands', player: [4, 3], banker: [2, 'A', 5], intro: 'The Player stands on 6 or 7; the Banker then uses the simple rule.' },
  { id: 'tie', label: 'Tie', player: [6, 'Q'], banker: [4, 2], intro: 'Equal totals are a tie: Player and Banker bets are returned.' },
];

export function BasicsLesson(): ReactNode {
  const { rules } = useSettings();
  const p = exactProbabilities(rules.decks);
  return (
    <LessonPage
      id="basics"
      sections={SECTIONS}
      lede="Baccarat is the simplest game on the casino floor: two hands, one bet, no decisions. This lesson shows you the table, the card values and a complete hand, dealt the way a dealer deals it."
    >
      <Section id="object" number={1} title="The object of the game">
        <Prose>
          <p>
            Every hand, the dealer deals two hands of cards: one called the <dfn>Player</dfn> and one called the <dfn>Banker</dfn>. The hand whose total is
            closer to <strong>9</strong> wins. Before the cards come out you bet on which hand will win — Player, Banker, or a Tie — and from then on you do
            nothing. The dealer deals, applies the drawing rules, announces the result and pays the winners.
          </p>
          <p>
            Despite the names, you are not “the Player” and the house is not “the Banker”. They are just the two hands. Anyone at the table can back either
            one, and most of the people around you will be betting on the Banker because it wins slightly more often (the next lessons explain why, and what
            the house charges for the privilege).
          </p>
        </Prose>
        <Facts
          items={[
            { label: 'Player wins', value: formatPercent(p.player, 2), sub: 'of hands', tone: 'player' },
            { label: 'Banker wins', value: formatPercent(p.banker, 2), sub: 'of hands', tone: 'banker' },
            { label: 'Tie', value: formatPercent(p.tie, 2), sub: 'of hands', tone: 'tie' },
          ]}
        />
        <Callout tone="casino" title="No skill at the cards, real skill with the money">
          There is nothing to decide once your chips are down, so nobody can play a hand badly. Where players differ is in which bets they make and how
          they manage their money — which is exactly what the rest of this course is about.
        </Callout>
      </Section>

      <Section id="layout" number={2} title="A tour of the table">
        <Prose>
          <p>
            The layout below uses the same spot names and colours as the table in Play mode: <strong>Banker in red, Player in blue, Tie in green</strong>,
            the two EZ bonus bets in the middle band, and the pair bets at the ends. Click anything to learn what it is, what it pays and what it costs at
            your table’s current rules.
          </p>
        </Prose>
        <TableTour rules={rules} />
      </Section>

      <Section id="values" number={3} title="Card values and totals">
        <Prose>
          <p>
            Cards count at face value from 2 to 9, an <strong>Ace counts 1</strong>, and <strong>10, Jack, Queen and King count 0</strong>. Suits mean
            nothing. A hand’s total is the sum of its cards with only the <strong>last digit</strong> kept — there is no “bust” in baccarat, totals simply
            wrap around: 7 + 8 = 15 counts as 5, and 5 + 5 = 10 counts as 0.
          </p>
        </Prose>
        <Table caption="Card values" compact>
          <thead>
            <tr>
              <th scope="col">Cards</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tableClass.strong}>Ace</td>
              <td>1</td>
            </tr>
            <tr>
              <td className={tableClass.strong}>2, 3, 4, 5, 6, 7, 8, 9</td>
              <td>Face value</td>
            </tr>
            <tr>
              <td className={tableClass.strong}>10, Jack, Queen, King</td>
              <td>0 (nothing)</td>
            </tr>
          </tbody>
        </Table>
        <HandsRow>
          <HandCards side="player" label="7 + 8 = 15 → 5" cards={[{ rank: '7', suit: 'H' }, { rank: '8', suit: 'D' }]} size="sm" />
          <HandCards side="banker" label="King + 9 = 9" cards={[{ rank: 'K', suit: 'S' }, { rank: '9', suit: 'C' }]} size="sm" />
        </HandsRow>
        <HandsRow>
          <HandCards side="player" label="5 + 5 = 10 → 0" cards={[{ rank: '5', suit: 'S' }, { rank: '5', suit: 'H' }]} size="sm" />
          <HandCards side="banker" label="Ace + 4 + 7 = 12 → 2" cards={[{ rank: 'A', suit: 'D' }, { rank: '4', suit: 'C' }, { rank: '7', suit: 'S' }]} size="sm" />
        </HandsRow>
        <CardValueQuiz />
      </Section>

      <Section id="deal" number={4} title="How a hand is dealt">
        <Prose>
          <p>
            Cards come out of the shoe in a fixed order: <strong>Player, Banker, Player, Banker</strong>. If either hand’s first two cards total 8 or 9 —
            a <dfn>natural</dfn> — the hand is over. Otherwise the Player hand draws or stands by a fixed rule, then the Banker hand draws or stands by a
            fixed rule that also looks at the Player’s third card. Third cards are placed sideways across the first two. Step through the hands below and
            read the dealer’s call for every step; the explanation underneath says which rule applied.
          </p>
        </Prose>
        <SampleHand hands={HANDS} rules={rules} />
        <Callout tone="rule" title="The rules are the dealer’s job">
          You never choose whether to draw. <LessonLink to="third-card">Lesson 2</LessonLink> lays out the complete third-card table and lets you test any
          situation, but you can enjoy the game perfectly well without memorising it.
        </Callout>
      </Section>

      <Section id="winning" number={5} title="Who wins and what you are paid">
        <Prose>
          <p>
            When both hands are finished, the higher total wins. Bets on the winning hand are paid even money (1 to 1); bets on the losing hand are
            collected. If the totals are equal it is a <dfn>tie</dfn>: Player and Banker bets are returned untouched (“push”) and only Tie bets are paid,
            at {rules.tiePays} to 1.
          </p>
          <p>
            At an EZ Baccarat table the Banker bet pays full even money with no commission, with one exception: when the Banker wins with a three-card total
            of 7 (the <strong>Dragon 7</strong>) Banker bets push instead of being paid. That single rule is what lets the casino drop the usual 5%
            commission, and it is also a side bet of its own — <LessonLink to="dragon-panda">Lesson 4</LessonLink> covers both the Dragon 7 and its cousin
            the Panda 8.
          </p>
        </Prose>
        <Table caption="The main bets" compact>
          <thead>
            <tr>
              <th scope="col">Bet</th>
              <th scope="col">You win when</th>
              <th scope="col">Pays</th>
              <th scope="col">On a tie</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="c-player">Player</td>
              <td>the Player hand is closer to 9</td>
              <td>1 to 1</td>
              <td>bet returned</td>
            </tr>
            <tr>
              <td className="c-banker">Banker</td>
              <td>the Banker hand is closer to 9</td>
              <td>{rules.bankerRule === 'ez' ? '1 to 1, no commission (push on a Dragon 7)' : rules.bankerRule === 'commission' ? `1 to 1 less ${formatPercent(rules.commissionRate, 0)} commission` : '1 to 1 (half on a Banker 6)'}</td>
              <td>bet returned</td>
            </tr>
            <tr>
              <td className="c-tie">Tie</td>
              <td>both hands have the same total</td>
              <td>{rules.tiePays} to 1</td>
              <td>—</td>
            </tr>
          </tbody>
        </Table>
        <Callout tone="tip">
          The full payout table with exact probabilities and house edges — including the pair bets and the two bonuses — is in{' '}
          <LessonLink to="bets-and-odds">Lesson 3</LessonLink>.
        </Callout>
      </Section>

      <Section id="glossary" number={6} title="Words you will hear">
        <Table compact>
          <thead>
            <tr>
              <th scope="col">Term</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Shoe', `The box the cards are dealt from. It holds ${rules.decks} shuffled decks.`],
              ['Natural', 'A two-card total of 8 or 9. Ends the hand immediately.'],
              ['Stand / draw', 'Take no more cards / take a third card. Decided by the rules, never by you.'],
              ['Push', 'A bet that is neither won nor lost — your chips are returned.'],
              ['Commission', 'The 5% the house takes from winning Banker bets at a classic table. EZ tables charge none.'],
              ['Dragon 7', 'The Banker wins with a three-card total of 7. Banker bets push at an EZ table; the Dragon 7 side bet pays 40 to 1.'],
              ['Panda 8', 'The Player wins with a three-card total of 8. The Panda 8 side bet pays 25 to 1.'],
              ['Cut card', 'A coloured card placed near the end of the shoe. When it appears the current hand is finished, one more is dealt, and the shoe is reshuffled.'],
              ['Roads', 'The scoreboard grids that record the results of the shoe (Lesson 5).'],
              ['Unit', 'The amount of your standard bet, used when sizing a bankroll (Lesson 6).'],
            ].map(([term, text]) => (
              <tr key={term}>
                <td className={tableClass.strong}>{term}</td>
                <td>{text}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </LessonPage>
  );
}

export default BasicsLesson;
