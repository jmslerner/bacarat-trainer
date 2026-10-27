/**
 * Lesson 6 — Money Management: bankroll sizing, session swings, every betting system and how it fails.
 */
import type { ReactNode } from 'react';
import { houseEdge, outcomeProbabilities } from '@/engine';
import { formatMoney, formatNumber, formatPercent, useSettings } from '@/ui/shell';
import { Callout, Facts, LessonLink, LessonPage, LinkCard, LinkRow, Prose, Section, Table, tableClass } from './components';
import { sessionExpectation } from './math';
import { MartingaleExplorer } from './widgets/MartingaleExplorer';

const SECTIONS = [
  { id: 'edge', title: 'Nothing changes the edge' },
  { id: 'bankroll', title: 'Sizing a session bankroll' },
  { id: 'systems', title: 'The betting systems' },
  { id: 'martingale', title: 'Martingale under a microscope' },
  { id: 'discipline', title: 'Stop-losses, win goals and tilt' },
  { id: 'lab', title: 'See for yourself in the Lab' },
] as const;

interface SystemRow {
  name: string;
  how: string;
  feels: string;
  fails: string;
}

const SYSTEMS: readonly SystemRow[] = [
  {
    name: 'Flat betting',
    how: 'The same amount every hand.',
    feels: 'Boring, steady, the smallest swings for a given amount of action.',
    fails: 'It does not fail — it just loses the house edge, slowly. Every other system below loses the same percentage of the money it puts through.',
  },
  {
    name: 'Martingale',
    how: 'Double after every loss; return to one unit after a win. Each completed sequence wins one unit.',
    feels: 'Wins almost every sequence. Weeks of small profits.',
    fails: 'A losing streak reaches the table maximum (or your bankroll) and the next loss wipes out hundreds of units at once — exactly as often as needed to restore the house edge.',
  },
  {
    name: 'Grand Martingale',
    how: 'Double after every loss and add one more unit, so a winning sequence nets one unit per loss suffered.',
    feels: 'Even juicier recoveries than the Martingale.',
    fails: 'Bets grow faster than doubling, so the limit is reached a step sooner and the bust is bigger.',
  },
  {
    name: 'Paroli (reverse Martingale)',
    how: 'Double after a win, up to three wins in a row, then start again; after a loss go back to one unit.',
    feels: 'Streaks pay 7 units for 1 at risk; losses are small.',
    fails: 'Most attempts die at the first or second step. Three wins in a row with the house’s money happens just often enough to pay the losses — minus the edge.',
  },
  {
    name: '1-3-2-6',
    how: 'Bet 1, 3, 2 then 6 units on consecutive wins; any loss restarts at 1.',
    feels: 'A capped Paroli: a full cycle wins 12 units having risked 2 of your own.',
    fails: 'A loss on the third or fourth bet gives back what the cycle had won. Over many cycles the arithmetic is flat betting in disguise.',
  },
  {
    name: 'Fibonacci',
    how: 'After a loss move one step up the sequence 1, 1, 2, 3, 5, 8…; after a win move two steps back.',
    feels: 'Gentler than doubling; a win recovers the last two losses.',
    fails: 'A long losing run still climbs to big bets, and you need two wins to come back down — the slow climb only delays the day the limit is hit.',
  },
  {
    name: 'd’Alembert',
    how: 'Add one unit after a loss, remove one after a win.',
    feels: 'Small steps, feels “balanced”: wins and losses should cancel.',
    fails: 'Wins and losses do not come in equal numbers (ties aside, Banker wins 50.7% of decided hands against Player). The bets drift upward during a bad run and sit there.',
  },
  {
    name: 'Labouchere (cancellation)',
    how: 'Write a list such as 1-2-3; bet the sum of the ends; cross both off after a win, add the lost bet to the end after a loss.',
    feels: 'You “only” need to win a third of your bets to finish the list.',
    fails: 'A losing run makes the list — and the bets — grow without bound; the list does not clear until a sequence of wins that the edge makes rarer than it looks.',
  },
  {
    name: 'Oscar’s Grind',
    how: 'Aim to win one unit per cycle: bet one unit, add a unit after each win, never more than needed to finish the cycle up one unit.',
    feels: 'Slow, patient, usually ends cycles with a one-unit profit.',
    fails: 'A deep hole takes a long series of bets to climb out of, during which the table limit or the bankroll can end the cycle in a large loss.',
  },
];

export function MoneyLesson(): ReactNode {
  const { rules } = useSettings();
  const unit = Math.max(rules.limits.main.min, 25);
  const hour = sessionExpectation('banker', unit, 70, rules);
  const session = sessionExpectation('banker', unit, 140, rules);
  const bankerEdge = houseEdge('banker', rules);
  const pb = outcomeProbabilities('banker', rules);
  const unitsForTwoSd = Math.ceil((2 * session.stdDev) / unit);

  return (
    <LessonPage
      id="money"
      sections={SECTIONS}
      lede="No betting pattern changes the house edge. What money management can do is decide how long you play, how big the swings are, and whether a bad night is survivable. Here is how to size a bankroll — and every popular betting system with the exact way it breaks."
    >
      <Section id="edge" number={1} title="Nothing changes the edge">
        <Prose>
          <p>
            Your expected loss is <strong>total money wagered × house edge</strong>. A betting system changes <em>how much</em> you wager on each hand,
            but every hand it has you bet still costs the same percentage. Add up the expected losses of any sequence of bets — doubled, tripled,
            scheduled however you like — and the total is just the edge times the total action. No arrangement of negative numbers adds up to a
            positive one.
          </p>
          <p>
            What systems do change is the <em>shape</em> of the results: a Martingale turns a steady trickle of losses into long runs of small wins
            punctuated by one disaster; a Paroli does the opposite. Choosing a system is choosing which shape you prefer, at the same price.
          </p>
        </Prose>
        <Callout tone="math" title="Why it has to be so">
          Each bet has expected value −(edge × amount). Expectation is additive: the expected value of a whole session is the sum of its bets’ expected
          values, no matter how the amounts were chosen or whether they depended on earlier results. That sum is −edge × (total wagered). Full stop.
        </Callout>
      </Section>

      <Section id="bankroll" number={2} title="Sizing a session bankroll">
        <Prose>
          <p>
            Choose a <dfn>unit</dfn> — your standard bet — and buy in with enough units to ride out the normal swings of the session you plan. Below is
            the arithmetic for {formatMoney(unit)} units on the Banker at your table, at 70 hands an hour.
          </p>
        </Prose>
        <Facts
          items={[
            { label: 'Expected loss per hour', value: formatMoney(-hour.expectedNet, { cents: true }), sub: `${formatPercent(bankerEdge, 2)} of ${formatMoney(hour.wagered)} wagered`, tone: 'negative' },
            { label: 'Typical swing per hour', value: `± ${formatMoney(Math.round(hour.stdDev))}`, sub: `about ${formatNumber(hour.stdDev / unit, 1)} units`, tone: 'gold' },
            { label: 'Two-hour session, 2σ', value: `${formatMoney(Math.round(2 * session.stdDev))}`, sub: `${unitsForTwoSd} units covers 95% of sessions`, tone: 'gold' },
            { label: 'Banker win / lose', value: `${formatPercent(pb.win, 1)} / ${formatPercent(pb.lose, 1)}`, sub: `${formatPercent(pb.push, 1)} push` },
          ]}
        />
        <Prose>
          <ul>
            <li>
              <strong>Session bankroll: 30–40 units</strong> for a couple of hours of flat betting. {unitsForTwoSd} units covers about 19 sessions in 20;
              a run worse than that is rare but not impossible, so bring money you can lose entirely.
            </li>
            <li>
              <strong>Never let the unit grow with the losses.</strong> Chasing turns a −1-unit night into a −20-unit night more reliably than anything
              the cards do.
            </li>
            <li>
              <strong>Price the hour, not the hand.</strong> At {formatMoney(unit)} a hand the Banker bet costs about {formatMoney(-hour.expectedNet, { cents: true })} an
              hour on average. If that is a fair price for the entertainment, play; if not, lower the unit or play fewer hands.
            </li>
            <li>
              <strong>Side bets need a separate budget.</strong> A {formatMoney(rules.limits.side.min)} Dragon 7 bet every hand costs{' '}
              {formatMoney(-sessionExpectation('dragon7', rules.limits.side.min, 70, rules).expectedNet, { cents: true })} an hour — and its swings are
              enormous (<LessonLink to="dragon-panda">Lesson 4</LessonLink>).
            </li>
          </ul>
        </Prose>
      </Section>

      <Section id="systems" number={3} title="The betting systems">
        <Prose>
          <p>
            Every system in the Strategy Lab, with what it does, what it feels like, and the mechanism by which it loses — because each one does, by
            exactly the house edge on the money it puts through.
          </p>
        </Prose>
        <Table caption="Betting systems and their failure modes">
          <thead>
            <tr>
              <th scope="col">System</th>
              <th scope="col">How it works</th>
              <th scope="col">What it feels like</th>
              <th scope="col">Where it breaks</th>
            </tr>
          </thead>
          <tbody>
            {SYSTEMS.map((s) => (
              <tr key={s.name}>
                <td className={tableClass.strong}>{s.name}</td>
                <td>{s.how}</td>
                <td className={tableClass.muted}>{s.feels}</td>
                <td>{s.fails}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Callout tone="warn" title="Positive progressions are not safer, only different">
          Paroli-style systems (press after a win) keep your own money small and “play with the house’s”. The house does not see it that way: those chips
          were yours the moment they were paid, and pressing them is just a bigger bet with the same edge.
        </Callout>
      </Section>

      <Section id="martingale" number={4} title="Martingale under a microscope">
        <Prose>
          <p>
            The Martingale is the system everyone invents, so it deserves the numbers. Set your starting bet and the table maximum and the explorer works
            out how many doublings fit, how often the sequence busts, and what the bust costs. The “expected per sequence” line is the house edge wearing a
            different coat.
          </p>
        </Prose>
        <MartingaleExplorer rules={rules} />
      </Section>

      <Section id="discipline" number={5} title="Stop-losses, win goals and tilt">
        <Prose>
          <p>
            A stop-loss (“I quit when I am down 20 units”) and a win goal (“I quit when I am up 15”) do not change the expected value of a hand either.
            What they change is how long you play, and since every hand costs money, <strong>playing fewer hands is the only money-management decision
            that lowers the expected loss</strong>. Set both before you sit down, write them on your phone if you must, and leave when you hit one.
          </p>
          <ul>
            <li>
              <strong>Tilt</strong> — raising bets to get even — is the single biggest cause of disastrous sessions. The stop-loss is there to protect
              you from yourself, not from the cards.
            </li>
            <li>
              <strong>Win goals</strong> lock in the good sessions that the swings hand you. Over a lifetime the goals do not beat the edge; over an
              evening they stop a +15 from becoming a −30.
            </li>
            <li>
              <strong>Time limits</strong> work as well as money limits, and they are easier to keep.
            </li>
          </ul>
        </Prose>
        <Callout tone="casino" title="Responsible play">
          Gamble with money set aside for entertainment, never with money you need. If you find it hard to stop, help is available: in the US call or text
          1-800-GAMBLER.
        </Callout>
      </Section>

      <Section id="lab" number={6} title="See for yourself in the Lab">
        <Prose>
          <p>
            The Strategy Lab deals millions of hands with the same engine as the table and plots the bankroll curves. Run the presets below: every one of
            them ends with a realized edge equal to the house edge, and the Martingale’s risk of ruin speaks for itself.
          </p>
        </Prose>
        <LinkRow>
          <LinkCard href="#lab/flatBanker" kicker="Lab preset">
            Flat Banker
          </LinkCard>
          <LinkCard href="#lab/martingalePlayer" kicker="Lab preset">
            Martingale on Player
          </LinkCard>
          <LinkCard href="#lab/paroliStreaks" kicker="Lab preset">
            Paroli on streaks
          </LinkCard>
          <LinkCard href="#lab/oneThreeTwoSixBanker" kicker="Lab preset">
            1-3-2-6 Banker
          </LinkCard>
        </LinkRow>
        <Prose>
          <p>
            Each card opens the Lab with that preset already selected: press Run and compare “realized edge” with the exact edge from{' '}
            <LessonLink to="bets-and-odds">Lesson 3</LessonLink>. Then try the “Count Dragon 7” preset for the only strategy that moves the number
            the other way — <LessonLink to="counting">Lesson 7</LessonLink>.
          </p>
        </Prose>
      </Section>
    </LessonPage>
  );
}

export default MoneyLesson;
