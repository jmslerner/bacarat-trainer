/**
 * Lesson 3 — Bets, Payouts and the House Edge: exact probabilities and edges for the active table, and what a
 * session costs.
 */
import type { ReactNode } from 'react';
import { cloneRules, exactProbabilities, houseEdge, type TableRules } from '@/engine';
import { formatMoney, formatPercent, useSettings } from '@/ui/shell';
import { Callout, Facts, LessonLink, LessonPage, Prose, Section, Table, tableClass } from './components';
import { CostCalculator } from './widgets/CostCalculator';
import { PayoutTable } from './widgets/PayoutTable';

const SECTIONS = [
  { id: 'edge', title: 'What the house edge means' },
  { id: 'table', title: 'Every bet at your table' },
  { id: 'banker', title: 'Why Banker is the best bet' },
  { id: 'tie', title: 'The Tie bet' },
  { id: 'cost', title: 'What a session costs' },
  { id: 'decks', title: 'Six decks or eight' },
] as const;

function withBankerRule(rules: TableRules, bankerRule: TableRules['bankerRule']): TableRules {
  return { ...cloneRules(rules), bankerRule };
}

export function BetsAndOddsLesson(): ReactNode {
  const { rules } = useSettings();
  const p = exactProbabilities(rules.decks);
  const ez = houseEdge('banker', withBankerRule(rules, 'ez'));
  const commission = houseEdge('banker', withBankerRule(rules, 'commission'));
  const super6 = houseEdge('banker', withBankerRule(rules, 'super6'));
  const player = houseEdge('player', rules);
  const tie8 = houseEdge('tie', { ...cloneRules(rules), tiePays: 8 });
  const tie9 = houseEdge('tie', { ...cloneRules(rules), tiePays: 9 });
  const six = exactProbabilities(6);
  const eight = exactProbabilities(8);
  const rulesSix = { ...cloneRules(rules), decks: 6 as const };
  const rulesEight = { ...cloneRules(rules), decks: 8 as const };

  return (
    <LessonPage
      id="bets-and-odds"
      sections={SECTIONS}
      lede="Every bet on the layout has a price: the house edge. These are the exact figures for your table, computed from the probabilities of every possible hand, not estimated — and a calculator for what that price adds up to over an evening."
    >
      <Section id="edge" number={1} title="What the house edge means">
        <Prose>
          <p>
            The <dfn>house edge</dfn> is the share of each bet the casino keeps on average. A 1.02% edge means that for every $100 you put on the Banker,
            in the long run you get $98.98 back — not on any one hand, where you win or lose the lot, but averaged over thousands of hands. Equivalently,
            your <dfn>expected loss</dfn> is simply <strong>amount bet × hands × house edge</strong>. Nothing about when or how much you bet changes that
            percentage; it only changes how big the swings are around it.
          </p>
          <p>
            Where does it come from? From paying a little less than the true odds. The Player hand wins {formatPercent(p.player, 2)} of hands and loses{' '}
            {formatPercent(p.banker, 2)} (the rest are ties, which push). Paid even money, the Player bet loses {formatPercent(p.banker - p.player, 2)} of
            its stake per hand on average — that is the Player house edge.
          </p>
        </Prose>
        <Callout tone="math" title="Expected value in one line">
          <p>
            EV per $1 = (probability of winning × amount won) − (probability of losing × $1). For the Player bet: {formatPercent(p.player, 2)} × $1 −{' '}
            {formatPercent(p.banker, 2)} × $1 = −{formatPercent(player, 2)} per dollar. A negative EV is the house edge with the sign flipped.
          </p>
        </Callout>
      </Section>

      <Section id="table" number={2} title="Every bet at your table">
        <Prose>
          <p>
            The table below reflects your table rules ({rules.decks} decks, Tie {rules.tiePays}:1, Dragon 7 {rules.dragon7Pays}:1, Panda 8{' '}
            {rules.panda8Pays}:1, pairs {rules.pairPays}:1). “Wins” is how often the bet is actually paid; “Pushes” is how often it is returned.
          </p>
        </Prose>
        <PayoutTable rules={rules} />
        <Callout tone="tip" title="Read the last column">
          The “costs per $100” column is the only honest price tag. A Banker bet costs about a dollar per hundred; a Panda 8 bet costs ten. Big payouts
          hide big prices.
        </Callout>
      </Section>

      <Section id="banker" number={3} title="Why Banker is the best bet">
        <Prose>
          <p>
            Banker wins more often than Player because it acts last (<LessonLink to="third-card">Lesson 2</LessonLink>). The casino claws most of that
            advantage back, but not quite all of it, so the Banker bet keeps the lowest house edge of any bet on the table however the table charges for it:
          </p>
        </Prose>
        <Facts
          items={[
            { label: 'Banker, EZ (Dragon 7 push)', value: formatPercent(ez, 2), sub: 'no commission', tone: rules.bankerRule === 'ez' ? 'gold' : 'neutral' },
            { label: 'Banker, 5% commission', value: formatPercent(commission, 2), sub: 'classic tables', tone: rules.bankerRule === 'commission' ? 'gold' : 'neutral' },
            { label: 'Banker, Super 6', value: formatPercent(super6, 2), sub: 'Banker 6 pays half', tone: rules.bankerRule === 'super6' ? 'gold' : 'neutral' },
            { label: 'Player', value: formatPercent(player, 2), sub: 'always 1:1', tone: 'player' },
          ]}
        />
        <Prose>
          <p>
            Two things follow. First, the EZ rule is marginally <em>better</em> for the player than paying commission: giving up the Dragon 7 wins costs
            you {formatPercent(p.dragon7, 2)} of your bet per hand, while a 5% commission on {formatPercent(p.banker, 2)} of hands costs{' '}
            {formatPercent(0.05 * p.banker, 2)}. Second, the gap between Banker and Player — about {formatPercent(player - ez, 2)} of each bet — is real but
            small: over a two-hour session it is worth a few dollars, not a change of fortune. Bet Banker because it is cheapest, not because it “is due”.
          </p>
        </Prose>
      </Section>

      <Section id="tie" number={4} title="The Tie bet">
        <Prose>
          <p>
            Ties happen on {formatPercent(p.tie, 2)} of hands — roughly one in {Math.round(1 / p.tie)}. A fair payout would be about{' '}
            {((1 - p.tie) / p.tie).toFixed(1)} to 1. The table pays {rules.tiePays} to 1, and the difference is the house edge:{' '}
            <strong>{formatPercent(tie8, 2)} at 8:1</strong>, or {formatPercent(tie9, 2)} at the 9:1 tables you occasionally find. At 8:1 the Tie is
            fourteen times as expensive as the Banker bet.
          </p>
          <p>
            One subtlety in its favour: since Player and Banker bets push on a tie, a Tie bet is the only way to have action on those hands. That is a
            reason to understand it, not a reason to make it.
          </p>
        </Prose>
        <Callout tone="warn" title="The 9:1 trap">
          A 9:1 table still carries a {formatPercent(tie9, 2)} edge — four times the Banker bet. “Better than 8:1” is not the same as “good”.
        </Callout>
      </Section>

      <Section id="cost" number={5} title="What a session costs">
        <Prose>
          <p>
            Multiply the bet by the number of hands and the house edge and you have the price of the seat. The calculator uses the exact edge for the bet
            you choose at your table, and it also shows the size of a typical swing, which is why individual sessions feel nothing like the average.
          </p>
        </Prose>
        <CostCalculator rules={rules} />
        <Callout tone="casino" title="Hands per hour">
          A full, slow big-baccarat table deals 40–50 hands an hour; a midi table with a dealer squeeze 60–70; a mini-bac table with no squeeze can deal
          over 100. The same bet costs twice as much at twice the speed — speed, not bet size, is the quiet killer.
        </Callout>
      </Section>

      <Section id="decks" number={6} title="Six decks or eight">
        <Prose>
          <p>
            Most tables use eight decks; some use six. The difference is tiny — the probabilities move in the fourth decimal place — but it exists, and it
            cuts both ways: six decks are fractionally better for the Banker, fractionally worse for the Player and the Tie, and markedly worse for the pair
            bets (pairs are rarer with fewer decks).
          </p>
        </Prose>
        <Table caption="Six versus eight decks" compact>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col" className={tableClass.num}>
                6 decks
              </th>
              <th scope="col" className={tableClass.num}>
                8 decks
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Player wins', formatPercent(six.player, 3), formatPercent(eight.player, 3)],
              ['Banker wins', formatPercent(six.banker, 3), formatPercent(eight.banker, 3)],
              ['Tie', formatPercent(six.tie, 3), formatPercent(eight.tie, 3)],
              ['Pair on a side', formatPercent(six.pair, 3), formatPercent(eight.pair, 3)],
              ['Banker edge (your Banker rule)', formatPercent(houseEdge('banker', rulesSix), 3), formatPercent(houseEdge('banker', rulesEight), 3)],
              ['Player edge', formatPercent(houseEdge('player', rulesSix), 3), formatPercent(houseEdge('player', rulesEight), 3)],
              [`Tie edge (${rules.tiePays}:1)`, formatPercent(houseEdge('tie', rulesSix), 3), formatPercent(houseEdge('tie', rulesEight), 3)],
              [`Pair edge (${rules.pairPays}:1)`, formatPercent(houseEdge('playerPair', rulesSix), 3), formatPercent(houseEdge('playerPair', rulesEight), 3)],
            ].map(([label, a, b]) => (
              <tr key={label}>
                <td className={tableClass.strong}>{label}</td>
                <td className={tableClass.num}>{a}</td>
                <td className={tableClass.num}>{b}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Prose>
          <p>
            For a {formatMoney(25)} Banker bettor the deck count changes the cost of an hour by less than a cent. Pick a table for its minimums, its pace
            and its rules on commission — not for its deck count.
          </p>
        </Prose>
      </Section>
    </LessonPage>
  );
}

export default BetsAndOddsLesson;
