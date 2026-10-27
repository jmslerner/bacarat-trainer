/**
 * Lesson 2 — The Third-Card Rules: the Player rule, the full Banker table and an interactive explorer.
 */
import type { ReactNode } from 'react';
import { exactProbabilities } from '@/engine';
import { formatPercent, useSettings } from '@/ui/shell';
import { Callout, Facts, LessonLink, LessonPage, Prose, Section, Table, tableClass } from './components';
import { ThirdCardExplorer } from './widgets/ThirdCardExplorer';
import { ThirdCardTable } from './widgets/ThirdCardTable';

const SECTIONS = [
  { id: 'tableau', title: 'The rules decide, not you' },
  { id: 'player', title: 'The Player’s rule' },
  { id: 'banker', title: 'The Banker’s rule' },
  { id: 'explorer', title: 'Try any situation' },
  { id: 'memory', title: 'Remembering the Banker table' },
  { id: 'why', title: 'Why the rules favour the Banker' },
] as const;

export function ThirdCardLesson(): ReactNode {
  const { rules } = useSettings();
  const p = exactProbabilities(rules.decks);
  return (
    <LessonPage
      id="third-card"
      sections={SECTIONS}
      lede="Whether a hand takes a third card is fixed by a table every casino in the world uses. Here is the whole of it, an explorer that explains every case in the dealer’s words, and the tricks dealers use to remember it."
    >
      <Section id="tableau" number={1} title="The rules decide, not you">
        <Prose>
          <p>
            After the first four cards (Player, Banker, Player, Banker) each hand has a two-card total from 0 to 9. The <dfn>tableau</dfn> — the drawing
            rules — then plays out automatically in this order:
          </p>
          <ol>
            <li>
              <strong>Naturals first.</strong> If either hand totals 8 or 9, both hands stand. Nothing else is checked.
            </li>
            <li>
              <strong>Player acts.</strong> On 0–5 the Player draws a third card; on 6 or 7 the Player stands.
            </li>
            <li>
              <strong>Banker acts last.</strong> If the Player stood, the Banker uses the same simple rule (draw on 0–5, stand on 6–7). If the Player drew,
              the Banker consults the table below, which depends on the Banker’s total <em>and the value of the Player’s third card</em>.
            </li>
          </ol>
          <p>No hand ever takes more than one extra card, so a hand uses four, five or six cards in all.</p>
        </Prose>
        <Facts
          items={[
            { label: 'Hand ends on 4 cards', value: formatPercent(p.cards4, 1), sub: 'natural, or both stand' },
            { label: 'Uses 5 cards', value: formatPercent(p.cards5, 1), sub: 'one side draws' },
            { label: 'Uses 6 cards', value: formatPercent(p.cards6, 1), sub: 'both sides draw' },
            { label: 'Natural on a given side', value: formatPercent(p.natural, 1), sub: 'two-card 8 or 9' },
          ]}
        />
      </Section>

      <Section id="player" number={2} title="The Player’s rule">
        <Prose>
          <p>
            The Player hand never sees the Banker’s cards and follows one line: <strong>draw on 0, 1, 2, 3, 4 or 5; stand on 6 or 7</strong> (8 and 9 are
            naturals). Think of it as the Player trying to improve a weak hand: five or less is weak, so a card is taken.
          </p>
        </Prose>
        <Table caption="Player two-card total" compact>
          <thead>
            <tr>
              <th scope="col">Total</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tableClass.strong}>0, 1, 2, 3, 4, 5</td>
              <td className="c-tie">Draws a third card</td>
            </tr>
            <tr>
              <td className={tableClass.strong}>6, 7</td>
              <td className="c-banker">Stands</td>
            </tr>
            <tr>
              <td className={tableClass.strong}>8, 9</td>
              <td className="c-gold">Natural — stands, and the Banker stands too</td>
            </tr>
          </tbody>
        </Table>
      </Section>

      <Section id="banker" number={3} title="The Banker’s rule">
        <Prose>
          <p>
            When the Player <em>stood</em>, the Banker simply draws on 0–5 and stands on 6–7. When the Player <em>drew</em>, the Banker’s decision
            depends on the <strong>value</strong> of that third card. Read the row for the Banker’s two-card total and the column for the Player’s third
            card: D means the Banker draws, S means the Banker stands. The grid is generated from the same rule function the table uses to deal.
          </p>
        </Prose>
        <ThirdCardTable />
        <Callout tone="rule" title="The 8 is the odd one out">
          A Banker 3 draws against every Player third card except an 8. Everything else follows a shrinking window: Banker 4 draws on 2–7, Banker 5 on 4–7,
          Banker 6 only on 6 or 7, and Banker 7 never draws.
        </Callout>
      </Section>

      <Section id="explorer" number={4} title="Try any situation">
        <Prose>
          <p>
            Pick the two-card totals; if the Player draws, pick the third card’s value and watch the Banker’s decision change. Finish the hand with the
            Banker’s third card to see the result as the dealer would call it.
          </p>
        </Prose>
        <ThirdCardExplorer rules={rules} />
      </Section>

      <Section id="memory" number={5} title="Remembering the Banker table">
        <Prose>
          <ul>
            <li>
              <strong>Banker 0, 1, 2: always draws.</strong> Those hands are too weak to sit on.
            </li>
            <li>
              <strong>Banker 7: always stands.</strong> The same as the Player’s rule.
            </li>
            <li>
              <strong>Banker 3: draws unless the Player’s third card is an 8.</strong> The only exception on the table.
            </li>
            <li>
              <strong>Banker 4, 5, 6: a window that closes.</strong> Each draws when the Player’s third card is in a range that ends at 7 and starts at
              2 × (Banker total − 3): Banker 4 → 2–7, Banker 5 → 4–7, Banker 6 → 6–7.
            </li>
            <li>
              <strong>Player’s third card 8 or 9 (or 0, 1):</strong> the Banker only draws with 0–2 (and with 3 against a 9, 0 or 1). A high Player
              third card usually does not help the Player (it wraps around), so the Banker stops drawing earlier.
            </li>
          </ul>
          <p>
            The <LessonLink to="basics">step-through hands in Lesson 1</LessonLink> and the third-card drill are the fastest way to make it automatic.
          </p>
        </Prose>
      </Section>

      <Section id="why" number={6} title="Why the rules favour the Banker">
        <Prose>
          <p>
            The Banker acts last and sees the Player’s third card before deciding. That information is worth a little: on a full shoe the Banker hand wins{' '}
            <strong>{formatPercent(p.banker, 2)}</strong> of hands and the Player hand <strong>{formatPercent(p.player, 2)}</strong>, with{' '}
            {formatPercent(p.tie, 2)} ties. Paid at even money, a Banker bet would therefore be a <em>winning</em> bet — which is why classic tables take a 5%
            commission from Banker wins, and why EZ tables take the Dragon 7 push instead. <LessonLink to="bets-and-odds">Lesson 3</LessonLink> turns these
            numbers into house edges.
          </p>
        </Prose>
        <Facts
          items={[
            { label: 'Banker wins', value: formatPercent(p.banker, 2), tone: 'banker' },
            { label: 'Player wins', value: formatPercent(p.player, 2), tone: 'player' },
            { label: 'Banker’s advantage', value: formatPercent(p.banker - p.player, 2), sub: 'before any commission', tone: 'gold' },
          ]}
        />
      </Section>
    </LessonPage>
  );
}

export default ThirdCardLesson;
