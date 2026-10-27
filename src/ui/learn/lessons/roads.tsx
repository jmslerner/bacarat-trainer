/**
 * Lesson 5 — Reading the Roads: bead plate, big road, derived roads and "ask road", with live examples
 * rendered by the same components as the table's scoreboard.
 */
import type { ReactNode } from 'react';
import { exactProbabilities } from '@/engine';
import { formatPercent, useSettings } from '@/ui/shell';
import { Callout, LessonLink, LessonPage, LinkCard, LinkRow, OutcomeBadge, Prose, Section } from './components';
import { ROAD_EXAMPLES } from './roadsLogic';
import { DerivationList, RoadExample, ScoreboardDemo } from './widgets/RoadExample';

const SECTIONS = [
  { id: 'why', title: 'Why there are roads' },
  { id: 'bead', title: 'The bead plate' },
  { id: 'big', title: 'The big road' },
  { id: 'derived', title: 'The three derived roads' },
  { id: 'ask', title: 'Asking the road' },
  { id: 'truth', title: 'What roads can and cannot tell you' },
] as const;

const EX_INTRO = ROAD_EXAMPLES.intro;
const EX_TIES = ROAD_EXAMPLES.ties;
const EX_TAIL = ROAD_EXAMPLES.tail;
const EX_DERIVED = ROAD_EXAMPLES.derived;
const EX_BOARD = ROAD_EXAMPLES.board;

export function RoadsLesson(): ReactNode {
  const { rules } = useSettings();
  const p = exactProbabilities(rules.decks);
  return (
    <LessonPage
      id="roads"
      sections={SECTIONS}
      lede="Every baccarat table has a scoreboard full of red and blue circles. This lesson explains each grid exactly as the casino’s display draws it — with live examples — and finishes with the one thing the roads cannot do."
    >
      <Section id="why" number={1} title="Why there are roads">
        <Prose>
          <p>
            Baccarat players like to see the history of the shoe, so casinos record every result on a set of grids called <dfn>roads</dfn>: the{' '}
            <strong>bead plate</strong>, the <strong>big road</strong>, and three “derived” roads — the <strong>big eye boy</strong>, the{' '}
            <strong>small road</strong> and the <strong>cockroach pig</strong>. Electronic displays draw them automatically; at older tables players kept
            them by hand on paper cards. The conventions are the same everywhere: <OutcomeBadge outcome="banker" small /> Banker is red,{' '}
            <OutcomeBadge outcome="player" small /> Player is blue, <OutcomeBadge outcome="tie" small /> Tie is green.
          </p>
          <p>Each example below is a fixed sequence of results drawn by the same code that draws the table’s scoreboard.</p>
        </Prose>
      </Section>

      <Section id="bead" number={2} title="The bead plate">
        <Prose>
          <p>
            The simplest record: every hand in order, filling a six-row grid column by column, top to bottom. Nothing is skipped — ties get their own
            green bead — so the bead plate is a plain diary of the shoe. Small dots mark pairs (blue top-left for a Player Pair, red bottom-right for a
            Banker Pair), and the table’s display also rings the Dragon 7 and Panda 8 hands in gold.
          </p>
        </Prose>
        <RoadExample title="Bead plate" hint="Ten hands, read down each column." sequence={EX_INTRO} roads={['bead']} cols={10} />
      </Section>

      <Section id="big" number={3} title="The big road">
        <Prose>
          <p>
            The big road is the one people actually read. Only Player and Banker results make a cell: the same side <strong>continues down</strong> the
            current column, and a change of side <strong>starts a new column</strong> at the top. A column is therefore a streak, and its depth is the
            streak’s length. A <strong>tie</strong> does not get a cell of its own: it is drawn as a green slash across the most recent cell (with a number
            when several ties follow each other), and ties before the first Player or Banker result sit alone at the top-left until a cell arrives.
          </p>
        </Prose>
        <RoadExample title="Big road" hint="Same ten hands as the bead plate." sequence={EX_INTRO} roads={['bead', 'big']} cols={10}>
          <Prose>
            <p>
              Hands 1–2 are Banker, so column 1 is two red cells deep. Hand 3 is Player: a new column. Hands 4–6 are three Bankers: a third column, three
              deep. The tie on hand 7 is slashed across that last Banker cell. Then two Players and a Banker: two more columns.
            </p>
          </Prose>
        </RoadExample>
        <RoadExample title="Ties and leading ties" hint="Ties never create a cell; they decorate the last one." sequence={EX_TIES} roads={['big']} cols={10}>
          <Prose>
            <p>
              The shoe opens with a tie, which has nothing to attach to, so it waits at the top-left and is folded into the first Banker cell (hand 2). The
              tie on hand 4 is slashed across the second Banker cell. Hands 6 and 7 are two ties in a row: one slash with a “2” on the Player cell before
              them (hand 5). Hand 8 is another Player, so that column grows to two deep, and hand 9 starts a Banker column.
            </p>
          </Prose>
        </RoadExample>
        <RoadExample title="The dragon tail" hint="A streak longer than the grid is tall." sequence={EX_TAIL} roads={['big']} cols={10}>
          <Prose>
            <p>
              Eight Bankers in a row, on a six-row grid: when the next cell down would fall off the bottom (or land on an occupied cell) the streak turns
              right and runs along the row instead — the <dfn>dragon tail</dfn>. The next column starts at the top of the column after the streak’s{' '}
              <em>first</em> cell; if that square is taken by a tail, it moves right until it finds a free one. The derived roads work from the logical
              column depths (here 8, 2, 1), not from where the tail happened to be drawn.
            </p>
          </Prose>
        </RoadExample>
      </Section>

      <Section id="derived" number={4} title="The three derived roads">
        <Prose>
          <p>
            The derived roads do not record results at all. They record whether the big road is being <em>regular</em> or <em>choppy</em>, by comparing
            the column being built with a column a fixed distance to its left: one column back for the <strong>big eye boy</strong>, two for the{' '}
            <strong>small road</strong>, three for the <strong>cockroach pig</strong>. Each new big-road cell adds one entry: <strong>red</strong> if
            it matches the pattern of the comparison column, <strong>blue</strong> if it breaks it. The rule, with <em>k</em> the offset and <em>L</em>[c]
            the depth of big-road column c:
          </p>
          <ul>
            <li>
              A cell that <strong>starts a new column</strong> c (needs c ≥ k + 2): red if columns c − 1 and c − 1 − k have the same depth, otherwise blue.
            </li>
            <li>
              A cell <strong>deeper in a column</strong>, at row r of column c (needs c ≥ k + 1): look at column c − k. Red if that column is at least r
              deep; blue if it stopped at exactly r − 1; red again if it is shorter than that.
            </li>
          </ul>
          <p>
            So the big eye boy starts at the second cell of column 2 (or the first cell of column 3), the small road one column later and the cockroach
            pig one later still. Entries are drawn like a big road of their own — same colour continues down, a change starts a new column, with dragon
            tails — using the display’s symbols: hollow circles for the big eye boy, solid dots for the small road, slashes for the cockroach pig.
          </p>
        </Prose>
        <RoadExample title="All three derived roads" hint="Eighteen hands; column depths 2, 2, 1, 3, 1, 1, 2, 2, 4." sequence={EX_DERIVED} roads={['big', 'bigEye', 'small', 'cockroach']} cols={10} />
        <Prose>
          <h3>Big eye boy, entry by entry</h3>
          <p>The first six entries of the big eye boy for the sequence above, each with the comparison that decided its colour:</p>
        </Prose>
        <DerivationList sequence={EX_DERIVED} kind="bigEye" limit={6} />
        <Prose>
          <h3>Small road and cockroach pig</h3>
          <p>The same procedure, looking two and three columns back:</p>
        </Prose>
        <DerivationList sequence={EX_DERIVED} kind="small" limit={4} />
        <DerivationList sequence={EX_DERIVED} kind="cockroach" limit={4} />
        <Callout tone="tip" title="How players read them">
          Lots of red on a derived road means the shoe has been “orderly” (streaks of similar lengths, or regular alternation); lots of blue means it has
          been choppy. Players who “follow the road” bet so that the next entry would be red. It is a description of the past dressed up as a forecast —
          see section 6.
        </Callout>
      </Section>

      <Section id="ask" number={5} title="Asking the road">
        <Prose>
          <p>
            Because every entry is determined by the results so far plus the next one, the display can show you in advance what each derived road{' '}
            <em>would</em> add if the next hand were Player, or if it were Banker. That is the “Ask P / Ask B” feature (some displays call it “predict”).
            Try it on the example, then on the full scoreboard below, which is the exact component the Play table uses.
          </p>
        </Prose>
        <RoadExample title="Ask the roads" hint="Press Ask P or Ask B: ghost cells show where each road’s next entry would go and in which colour." sequence={EX_DERIVED} roads={['big', 'bigEye', 'small', 'cockroach']} cols={10} askable />
        <ScoreboardDemo sequence={EX_BOARD} title="Example scoreboard" />
      </Section>

      <Section id="truth" number={6} title="What roads can and cannot tell you">
        <Prose>
          <p>
            Roads are a faithful record of the shoe and a pleasant way to follow it. They are not a forecast. Each hand is dealt from the cards that
            remain, and the cards do not know what the last ten results were: after a run of six Bankers, the chance that the next hand is Banker is still{' '}
            <strong>{formatPercent(p.banker, 2)}</strong>, after a chop it is still {formatPercent(p.banker, 2)}, and the derived roads — which are
            arithmetic on those results — carry no information the results themselves do not have.
          </p>
          <p>
            Streaks and chops do happen, of course, exactly as often as coin flips produce them, and in hindsight the road always shows a pattern. That is
            what makes road-following feel like skill. It is not. Betting with the road, against it, or ignoring it altogether gives the same house edge on
            every hand; the Strategy Lab will show you that over a million hands in a few seconds.
          </p>
        </Prose>
        <Callout tone="truth" title="The honest statement">
          Roads describe the past. No pattern on any road changes the probability of the next hand, and no road-based system reduces the house edge. Use
          them to enjoy the shoe, keep track of what happened, and spot the Dragon 7s — not to decide what is “due”.
        </Callout>
        <LinkRow>
          <LinkCard href="#lab/paroliStreaks" kicker="Strategy Lab">
            Simulate “follow the streak” against flat Banker
          </LinkCard>
          <LinkCard href="#learn/money" kicker="Lesson 6">
            Why betting systems fail
          </LinkCard>
        </LinkRow>
        <Prose>
          <p>
            One thing the record <em>is</em> useful for: <LessonLink to="counting">counting the side bets</LessonLink> needs the cards, not the
            results — and the hand history in Play mode shows every card.
          </p>
        </Prose>
      </Section>
    </LessonPage>
  );
}

export default RoadsLesson;
