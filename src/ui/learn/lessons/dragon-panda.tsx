/**
 * Lesson 4 — Dragon 7 and Panda 8: the push that replaces the commission, and the two bonus bets.
 */
import type { ReactNode } from 'react';
import { exactProbabilities, houseEdge } from '@/engine';
import { formatMoney, formatOdds, formatPercent, useSettings } from '@/ui/shell';
import { Callout, Facts, LessonLink, LessonPage, Prose, Section } from './components';
import { fairOdds, handsPerHit } from './math';
import { BonusOdds } from './widgets/BonusOdds';
import { SampleHand, type SampleHandSpec } from './widgets/SampleHand';

const SECTIONS = [
  { id: 'what', title: 'What counts and what does not' },
  { id: 'push', title: 'The push that pays the commission' },
  { id: 'sidebets', title: 'The side bets: 40 to 1 and 25 to 1' },
  { id: 'table', title: 'At the table' },
  { id: 'beat', title: 'Can they be beaten?' },
] as const;

const HANDS: readonly SampleHandSpec[] = [
  { id: 'dragon', label: 'Dragon 7', player: [2, 3, 'A'], banker: [3, 'K', 4], intro: 'The Banker will win with a three-card 7.' },
  { id: 'panda', label: 'Panda 8', player: [4, 'A', 3], banker: [2, 4], intro: 'The Player will win with a three-card 8.' },
  { id: 'twocard7', label: 'Two-card 7', player: [2, 2, 'K'], banker: [3, 4], intro: 'The Banker wins with a 7 — but on two cards, so it is not a Dragon 7.' },
  { id: 'tie7', label: '7–7 tie', player: [3, 4], banker: [2, 'A', 4], intro: 'The Banker makes a three-card 7 but only ties: no Dragon 7.' },
  { id: 'natural8', label: 'Natural 8', player: ['K', 8], banker: [4, 3], intro: 'The Player wins with an 8 on two cards: a natural, not a Panda 8.' },
];

export function DragonPandaLesson(): ReactNode {
  const { rules } = useSettings();
  const p = exactProbabilities(rules.decks);
  const d7Edge = houseEdge('dragon7', rules);
  const p8Edge = houseEdge('panda8', rules);
  const bankerFair = p.banker - p.player;
  const commissionCost = 0.05 * p.banker;
  const pushCost = p.dragon7;

  return (
    <LessonPage
      id="dragon-panda"
      sections={SECTIONS}
      lede="EZ Baccarat replaces the 5% Banker commission with a single rule — a Banker win on a three-card 7 is a push — and sells side bets on that hand and on its mirror image, the Player’s three-card 8. Here is exactly how both work and what they cost."
    >
      <Section id="what" number={1} title="What counts and what does not">
        <Prose>
          <p>
            A <dfn>Dragon 7</dfn> is a Banker hand that <strong>wins</strong> with a <strong>three-card</strong> total of <strong>7</strong>. A{' '}
            <dfn>Panda 8</dfn> is a Player hand that <strong>wins</strong> with a <strong>three-card</strong> total of <strong>8</strong>. Every word
            matters: a two-card 7 is not a Dragon, a 7–7 tie is not a Dragon, and a natural 8 (two cards) is never a Panda. Step through the five hands
            below — two bonuses and three near-misses.
          </p>
        </Prose>
        <SampleHand hands={HANDS} rules={rules} title="Bonuses and near-misses" hint="Pick a hand, press Deal, then Next." />
      </Section>

      <Section id="push" number={2} title="The push that pays the commission">
        <Prose>
          <p>
            Paid at even money with no deduction at all, the Banker bet would be a winning bet: it wins {formatPercent(p.banker, 2)} of hands and loses{' '}
            {formatPercent(p.player, 2)}, a player edge of {formatPercent(bankerFair, 2)}. The casino has to take something back. Classic tables take 5%
            of every Banker win; EZ tables instead refuse to pay the Banker bet on a Dragon 7 — Banker chips just sit there and are returned.
          </p>
        </Prose>
        <Facts
          items={[
            { label: 'Banker edge at even money', value: `+${formatPercent(bankerFair, 2)}`, sub: 'in the player’s favour, before the charge', tone: 'positive' },
            { label: '5% commission costs', value: formatPercent(commissionCost, 2), sub: `5% × ${formatPercent(p.banker, 2)} Banker wins`, tone: 'negative' },
            { label: 'Dragon 7 push costs', value: formatPercent(pushCost, 2), sub: `one bet lost on ${formatPercent(p.dragon7, 2)} of hands`, tone: 'negative' },
            { label: 'House edge, classic', value: formatPercent(commissionCost - bankerFair, 2), sub: 'commission − advantage' },
            { label: 'House edge, EZ', value: formatPercent(pushCost - bankerFair, 2), sub: 'push − advantage', tone: 'gold' },
          ]}
        />
        <Prose>
          <p>
            The push is worth slightly less to the house than the commission, so EZ Banker is the cheaper bet — by {formatPercent(commissionCost - pushCost, 3)}{' '}
            of each bet. More importantly it is <em>simpler</em>: nobody tracks commission markers, nobody settles up when they leave, and the dealer pays
            every winning Banker bet in full. The one thing to remember is that about one hand in {Math.round(handsPerHit(p.dragon7))} your winning Banker
            bet comes back as a push, with the call “Dragon 7!”.
          </p>
        </Prose>
      </Section>

      <Section id="sidebets" number={3} title="The side bets: 40 to 1 and 25 to 1">
        <Prose>
          <p>
            The same two hands can be bet on directly. The Dragon 7 pays {formatOdds(rules.dragon7Pays)} and happens on {formatPercent(p.dragon7, 2)} of
            hands — once every {handsPerHit(p.dragon7).toFixed(1)} hands on average. A fair price would be about {formatOdds(Math.round(fairOdds(p.dragon7) * 10) / 10)};
            the shortfall is a house edge of <strong>{formatPercent(d7Edge, 2)}</strong>. The Panda 8 pays {formatOdds(rules.panda8Pays)} against a fair{' '}
            {formatOdds(Math.round(fairOdds(p.panda8) * 10) / 10)}, for an edge of <strong>{formatPercent(p8Edge, 2)}</strong> — it hits more often (once
            every {handsPerHit(p.panda8).toFixed(1)} hands) but is paid proportionally worse.
          </p>
        </Prose>
        <Callout tone="math" title="Why a big payout can still be a bad bet">
          <p>
            EV per $1 on the Dragon 7 = {rules.dragon7Pays} × {formatPercent(p.dragon7, 2)} − (1 − {formatPercent(p.dragon7, 2)}) = {formatPercent(rules.dragon7Pays * p.dragon7, 2)}{' '}
            − {formatPercent(1 - p.dragon7, 2)} = −{formatPercent(d7Edge, 2)}. You lose {formatMoney(1)} on {formatPercent(1 - p.dragon7, 1)} of hands and
            collect {formatMoney(rules.dragon7Pays)} on the rest; the wins do not quite cover the losses.
          </p>
        </Callout>
        <BonusOdds rules={rules} />
      </Section>

      <Section id="table" number={4} title="At the table">
        <Prose>
          <ul>
            <li>
              <strong>Spots.</strong> Dragon 7 and Panda 8 have their own spots in the middle band of the layout, with limits of {formatMoney(rules.limits.side.min)}–
              {formatMoney(rules.limits.side.max)} at your table. You can bet them with or without a main bet.
            </li>
            <li>
              <strong>The calls.</strong> After the result the dealer announces “Dragon 7!” or “Panda 8!”. On a Dragon 7 at an EZ table the dealer pays the
              Dragon 7 spot {formatOdds(rules.dragon7Pays)}, leaves Banker bets where they are (a push), and takes Player bets. On a Panda 8 the Panda spot is
              paid {formatOdds(rules.panda8Pays)} and Player bets are paid as usual.
            </li>
            <li>
              <strong>Pairs.</strong> The Player Pair and Banker Pair bets ({formatOdds(rules.pairPays)}, {formatPercent(houseEdge('playerPair', rules), 2)} edge) are
              settled on the first two cards and have nothing to do with the result.
            </li>
            <li>
              <strong>Classic and Super 6 tables</strong> usually do not deal the Dragon 7 and Panda 8 at all; they are EZ Baccarat’s bets.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section id="beat" number={5} title="Can they be beaten?">
        <Prose>
          <p>
            Yes, in principle. The Dragon 7 needs the Banker to draw a third card and land exactly on 7, which becomes more likely when the shoe is rich in
            8s and 9s and poor in 4s, 5s, 6s and 7s. That changes as cards come out, and a simple count tracks it: when enough of the “bad” cards are gone,
            a 40:1 payout becomes worth more than it costs. The Panda 8 has a count of its own. <LessonLink to="counting">Lesson 7</LessonLink> gives both
            counts, the thresholds, and the simulated return — with the realistic caveats. Without counting, treat both bets as entertainment priced at
            7–10% a hand.
          </p>
        </Prose>
        <Callout tone="truth" title="The Dragon 7 is not “due”">
          A long gap since the last Dragon 7 tells you nothing about the next hand. The count works because of which <em>cards</em> have left the shoe,
          never because of how many hands have passed.
        </Callout>
      </Section>
    </LessonPage>
  );
}

export default DragonPandaLesson;
