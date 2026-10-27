/**
 * Lesson 8 — Casino Procedure and Etiquette: shoe, cut card, burn, dealing, commission, limits, the squeeze,
 * etiquette, and the three Banker rules side by side.
 */
import type { ReactNode } from 'react';
import { exactProbabilities, MSG_CUT_CARD } from '@/engine';
import { formatMoney, formatPercent, useSettings } from '@/ui/shell';
import { Callout, Facts, LessonLink, LessonPage, Prose, Section, Table, tableClass } from './components';
import { VariantComparison } from './widgets/VariantComparison';

const SECTIONS = [
  { id: 'shoe', title: 'The shoe and the shuffle' },
  { id: 'cut', title: 'The cut card and the last hand' },
  { id: 'burn', title: 'The burn' },
  { id: 'dealing', title: 'Dealing and the dealer’s calls' },
  { id: 'commission', title: 'Commission' },
  { id: 'limits', title: 'Limits and placing bets' },
  { id: 'squeeze', title: 'The squeeze' },
  { id: 'etiquette', title: 'Etiquette' },
  { id: 'variants', title: 'EZ, classic and Super 6' },
] as const;

const CALLS: readonly [string, string][] = [
  ['“Place your bets… no more bets.”', 'Chips must be down before the first card; nothing is moved after the call.'],
  ['“Card to Player.” / “Card to Banker.”', 'Each card as it is dealt, in the order Player, Banker, Player, Banker.'],
  ['“Player shows 5, Banker shows 3.”', 'The two-card totals, before any third card.'],
  ['“Natural 9 — Player.”', 'A two-card 8 or 9: the hand ends.'],
  ['“Player draws.” / “Player stands.”', 'The Player’s rule applied: draw on 0–5, stand on 6–7.'],
  ['“Banker draws.” / “Banker stands.”', 'The Banker’s rule applied (Lesson 2).'],
  ['“Banker wins, 7 over 5.” / “Tie, 6 and 6.”', 'The result, winner first.'],
  ['“Dragon 7!” / “Panda 8!”', 'The bonus hands (Lesson 4). Banker bets push on a Dragon 7 at an EZ table.'],
  ['“Player Pair.” / “Banker Pair.”', 'Called on the first two cards, before the hand continues.'],
  [`“${MSG_CUT_CARD}”`, 'The cut card appeared during this hand.'],
];

export function CasinoProcedureLesson(): ReactNode {
  const { rules } = useSettings();
  const p = exactProbabilities(rules.decks);
  const total = rules.decks * 52;
  return (
    <LessonPage
      id="casino-procedure"
      sections={SECTIONS}
      lede="What actually happens at the table, from the shuffle to the last hand of the shoe — and how to behave while it does. The simulator follows the same procedure, so everything here is also a description of Play mode."
    >
      <Section id="shoe" number={1} title="The shoe and the shuffle">
        <Prose>
          <p>
            Baccarat is dealt from a <dfn>shoe</dfn> holding {rules.decks} decks — {total} cards. Between shoes the dealer (or a shuffling machine)
            shuffles all of them, a player is offered the <dfn>cut</dfn> with a coloured plastic card, and the dealer completes the cut and inserts a
            second plastic card, the <dfn>cut card</dfn>, about {rules.cutCardFromEnd} cards from the back. The cards go into the shoe and the burn
            procedure follows.
          </p>
          <p>
            Some rooms use pre-shuffled cards delivered sealed from a shuffling facility, or a continuous shuffling machine at low-limit tables. Nothing
            about the odds changes; what changes is whether a count can ever reach useful depth (<LessonLink to="counting">Lesson 7</LessonLink>).
          </p>
        </Prose>
      </Section>

      <Section id="cut" number={2} title="The cut card and the last hand">
        <Prose>
          <p>
            When the cut card comes out during a hand, that hand is completed normally. The dealer then deals <strong>one more hand</strong>, and after it
            the shoe is finished and the cards are shuffled. Displays and dealers warn you with “last hand” so you can decide whether to stay for the
            shuffle. With the cut card {rules.cutCardFromEnd} cards from the end there are always enough cards for the final hand (a hand never needs more
            than six).
          </p>
        </Prose>
        <Callout tone="casino" title="In the simulator">
          Play mode shows the cut-card position in the shoe at the top right, flashes “Last hand of the shoe” when the cut card has appeared, and runs
          the shuffle, cut and burn automatically before the next shoe.
        </Callout>
      </Section>

      <Section id="burn" number={3} title="The burn">
        <Prose>
          <p>
            At the start of a shoe the dealer turns the first card face up. Its value decides how many further cards are <dfn>burned</dfn> — discarded
            face down: a 2 through 9 burns that many, an Ace burns one, and a 10, Jack, Queen or King burns ten. The exposed card is public information
            (card counters count it); the burned cards are not, and nobody ever sees them.
          </p>
        </Prose>
        <Table compact caption="Burn procedure">
          <thead>
            <tr>
              <th scope="col">Exposed card</th>
              <th scope="col">Cards burned face down</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tableClass.strong}>Ace</td>
              <td>1</td>
            </tr>
            <tr>
              <td className={tableClass.strong}>2 – 9</td>
              <td>Face value (2 to 9)</td>
            </tr>
            <tr>
              <td className={tableClass.strong}>10, J, Q, K</td>
              <td>10</td>
            </tr>
          </tbody>
        </Table>
      </Section>

      <Section id="dealing" number={4} title="Dealing and the dealer’s calls">
        <Prose>
          <p>
            Cards are dealt Player, Banker, Player, Banker. At a big table the cards are passed to the player with the largest bet on each side to turn
            over; at midi and mini tables the dealer turns them. Third cards are placed <strong>sideways</strong> across the first two so everyone can see
            which card came third. The dealer calls every step aloud; the calls in the simulator are the real ones:
          </p>
        </Prose>
        <Table compact caption="The dealer’s calls">
          <thead>
            <tr>
              <th scope="col">Call</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {CALLS.map(([call, meaning]) => (
              <tr key={call}>
                <td className={tableClass.strong}>{call}</td>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Prose>
          <p>
            After the result the dealer settles in a fixed order: losing bets are collected first, then winning bets are paid, side bets included, and
            pushes are left untouched. Then the result goes up on the scoreboard and the next round of betting opens.
          </p>
        </Prose>
      </Section>

      <Section id="commission" number={5} title="Commission">
        <Prose>
          <p>
            At a <strong>classic</strong> table the house takes 5% of every winning Banker bet. At mini-baccarat tables the dealer deducts it as each
            winning bet is paid ({formatMoney(100)} wins {formatMoney(95)}), which is what the simulator does and tracks as “commission paid”. At big
            tables the dealer instead keeps a tally with markers (“lammers”) in a <dfn>commission box</dfn> in front of your seat, and you settle it at the
            end of the shoe or when you leave — never walk away owing commission.
          </p>
          <p>
            <strong>EZ Baccarat</strong> tables charge no commission; the Dragon 7 push does the same job (<LessonLink to="dragon-panda">Lesson 4</LessonLink>).{' '}
            <strong>Super 6</strong> tables also charge none, but pay only half on a Banker win with a total of 6, which happens on{' '}
            {formatPercent(p.bankerWin6, 2)} of hands.
          </p>
        </Prose>
      </Section>

      <Section id="limits" number={6} title="Limits and placing bets">
        <Facts
          items={[
            { label: 'Player / Banker', value: `${formatMoney(rules.limits.main.min)} – ${formatMoney(rules.limits.main.max)}` },
            { label: 'Tie', value: `${formatMoney(rules.limits.tie.min)} – ${formatMoney(rules.limits.tie.max)}` },
            { label: 'Side bets', value: `${formatMoney(rules.limits.side.min)} – ${formatMoney(rules.limits.side.max)}` },
          ]}
        />
        <Prose>
          <ul>
            <li>
              The plaque on the rail states the limits. The <strong>maximum</strong> is enforced as you place chips; the <strong>minimum</strong> is
              checked when the dealer deals — a bet below the minimum will be pointed out and must be topped up or withdrawn.
            </li>
            <li>Side bets usually have their own, lower limits, as above, and can be made with or without a main bet.</li>
            <li>Bets must be inside the painted spot. Chips on a line are the dealer’s to interpret; keep them tidy and you keep the argument.</li>
            <li>Once “no more bets” is called, do not touch your chips until the hand is settled — not to add, not to take back, not to straighten.</li>
            <li>Buy chips from the dealer by placing cash on the felt (never hand it over); when you leave, ask to be “coloured up” into larger chips.</li>
          </ul>
        </Prose>
      </Section>

      <Section id="squeeze" number={7} title="The squeeze">
        <Prose>
          <p>
            At big tables the player with the largest bet on a side may <dfn>squeeze</dfn> the cards: bend them slowly, peeking at the pips, drawing out
            the reveal. Midi tables let the dealer squeeze on the players’ behalf; mini-baccarat skips it and simply turns the cards. The squeeze changes
            nothing about the cards — they were set the moment the shoe was cut — but it is the theatre that makes baccarat baccarat, and it slows the
            game to 40–50 hands an hour, which is cheaper for you than a fast table (<LessonLink to="bets-and-odds">Lesson 3</LessonLink>).
          </p>
          <p>
            If you are handed the cards: squeeze them over the table, never below it; do not bend them past what the dealer allows; and hand them back
            face up when asked. Squeezed cards are retired after the shoe.
          </p>
        </Prose>
      </Section>

      <Section id="etiquette" number={8} title="Etiquette">
        <Prose>
          <ul>
            <li>
              <strong>Other players do not change your odds.</strong> Someone joining mid-shoe, leaving, or betting “against the table” has no effect
              on the cards you get. Glares are traditional; they are also pointless.
            </li>
            <li>
              <strong>Tip the dealer</strong> by placing a bet for them beside yours (“for the dealer”) or handing over a chip; a few dollars on a good
              run is the custom in US rooms.
            </li>
            <li>
              <strong>Keep the roads to yourself.</strong> Everyone reads them differently; the display is there for all, and nobody is obliged to
              follow anyone’s “pattern”.
            </li>
            <li>
              <strong>Do not touch cards</strong> unless they are handed to you, and never touch another player’s chips.
            </li>
            <li>
              <strong>Phones</strong> away from the table during a hand; many rooms forbid them at the rail entirely.
            </li>
            <li>
              <strong>Know your limits</strong> — the table’s and your own (<LessonLink to="money">Lesson 6</LessonLink>).
            </li>
          </ul>
        </Prose>
      </Section>

      <Section id="variants" number={9} title="EZ, classic and Super 6">
        <Prose>
          <p>
            You will meet three ways of charging for the Banker’s advantage. They are all cheap bets, and the differences are small, but they change
            what happens at the table: EZ Baccarat has the Dragon 7 push and the two bonus bets; classic tables have commission to settle; Super 6
            tables pay half on a Banker 6. Your current table rule is highlighted.
          </p>
        </Prose>
        <VariantComparison rules={rules} />
        <Callout tone="tip" title="Try each one">
          Settings lets you switch the table between the three presets (it starts a new shoe). The payouts, limits and even the commission box on the
          table follow the rule you pick — and so do every number in these lessons.
        </Callout>
      </Section>
    </LessonPage>
  );
}

export default CasinoProcedureLesson;
