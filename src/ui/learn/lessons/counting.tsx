/**
 * Lesson 7 — Counting the Side Bets: effect of removal, the Dragon 7 and Panda 8 counts, running and true
 * count, the simulated EV by true count, and what to expect in a real casino.
 */
import type { ReactNode } from 'react';
import { EOR_8_DECKS, EOR_8_DECKS_MAIN, exactProbabilities } from '@/engine';
import { formatMoney, formatNumber, formatPercent, formatSigned, useSettings } from '@/ui/shell';
import { Callout, Facts, LessonLink, LessonPage, LinkCard, LinkRow, Prose, Section } from './components';
import { COUNT_EV, DRAGON7_SYSTEM, PANDA8_SYSTEM } from './countingData';
import { CountEvTable, pooledAbove } from './widgets/CountEvTable';
import { CountWalkthrough } from './widgets/CountWalkthrough';
import { EorTable, TagRow } from './widgets/EorTable';

const SECTIONS = [
  { id: 'why', title: 'Why the main bets cannot be counted' },
  { id: 'eor', title: 'Effect of removal' },
  { id: 'dragon', title: 'The Dragon 7 count' },
  { id: 'panda', title: 'The Panda 8 count' },
  { id: 'running', title: 'Running count and true count' },
  { id: 'worth', title: 'What the count is worth' },
  { id: 'reality', title: 'Realistic expectations' },
] as const;

const SYSTEMS = { dragon7: DRAGON7_SYSTEM, panda8: PANDA8_SYSTEM };

export function CountingLesson(): ReactNode {
  const { rules } = useSettings();
  const p = exactProbabilities(rules.decks);
  const sideMax = rules.limits.side.max;
  const maxMain = Math.max(...EOR_8_DECKS_MAIN.bankerEz.map(Math.abs), ...EOR_8_DECKS_MAIN.player.map(Math.abs));
  const maxSide = Math.max(...EOR_8_DECKS.dragon7.map(Math.abs), ...EOR_8_DECKS.panda8.map(Math.abs));
  const d7Pooled = pooledAbove(COUNT_EV.dragon7, DRAGON7_SYSTEM.threshold);
  const p8Pooled = pooledAbove(COUNT_EV.panda8, PANDA8_SYSTEM.threshold);
  const d7Hourly = (d7Pooled.perHundredHands / 100) * 70 * sideMax;
  const p8Hourly = (p8Pooled.perHundredHands / 100) * 70 * sideMax;
  const bothHourly = d7Hourly + p8Hourly;

  return (
    <LessonPage
      id="counting"
      sections={SECTIONS}
      lede="Card counting cannot beat the Player or Banker bets, but it can beat the Dragon 7 and, with more effort, the Panda 8. This lesson gives both counts, shows how they follow from the mathematics of card removal, and reports what a simulation says they are worth — before the casino’s rules take their cut."
    >
      <Section id="why" number={1} title="Why the main bets cannot be counted">
        <Prose>
          <p>
            Counting works when removing certain cards from the shoe changes a bet’s expectation enough to matter. For the Player and Banker bets it
            barely moves: removing any single card from a full eight-deck shoe changes their EV by at most{' '}
            <strong>{(maxMain * 100).toFixed(3)}%</strong> of a bet. By the time enough cards have gone to produce a usable advantage the shoe has
            been cut off — and the advantage, when it finally appears, is worth pennies. Every serious analysis reaches the same conclusion: the
            main bets are unbeatable in practice.
          </p>
          <p>
            The bonus bets are different. A Dragon 7 needs very particular cards, so the removal effects are{' '}
            <strong>{(maxSide / maxMain).toFixed(0)} times larger</strong> (up to {(maxSide * 100).toFixed(2)}% per card), and a 40:1 payout
            amplifies them. That is a count worth keeping.
          </p>
        </Prose>
      </Section>

      <Section id="eor" number={2} title="Effect of removal">
        <Prose>
          <p>
            The <dfn>effect of removal</dfn> (EOR) of a card value is the change in a bet’s EV when one card of that value leaves a full shoe. Positive
            means the bet got better. For the Dragon 7, removing an 8 or a 9 helps and removing a 4, 5, 6 or 7 hurts — a Banker three-card 7 is easiest
            to make when the shoe is rich in 8s and 9s and poor in mid cards. A counting system is just a set of whole-number <dfn>tags</dfn> that
            approximate the EORs: cards whose removal helps get positive tags, so the count rises as they leave the shoe.
          </p>
        </Prose>
        <EorTable systems={SYSTEMS} />
      </Section>

      <Section id="dragon" number={3} title="The Dragon 7 count">
        <Prose>
          <p>
            Eliot Jacobson’s Dragon 7 count uses tags that are easy to keep at table speed: <strong>4, 5, 6, 7 count −1; 8 and 9 count +2</strong>;
            Aces, 2s, 3s and the zero-value cards count 0. It is balanced (a full shoe sums to zero). Bet the Dragon 7 when the true count is{' '}
            <strong>{formatSigned(DRAGON7_SYSTEM.threshold)} or more</strong>.
          </p>
        </Prose>
        <TagRow system={DRAGON7_SYSTEM} />
        <Callout tone="rule" title={DRAGON7_SYSTEM.name}>
          {DRAGON7_SYSTEM.description}
        </Callout>
      </Section>

      <Section id="panda" number={4} title="The Panda 8 count">
        <Prose>
          <p>
            The Panda 8 is the mirror image — the Player winning with a three-card 8 — but its EORs are less lopsided, so a level-1 count tracks it poorly.
            The strategy module derived the tag set below from the EOR table by searching every balanced set of small integers for the best betting
            correlation, then validated it by simulation. Bet the Panda 8 when its true count is <strong>{formatSigned(PANDA8_SYSTEM.threshold)} or more</strong>.
          </p>
        </Prose>
        <TagRow system={PANDA8_SYSTEM} />
        <Callout tone="rule" title={PANDA8_SYSTEM.name}>
          {PANDA8_SYSTEM.description}
        </Callout>
      </Section>

      <Section id="running" number={5} title="Running count and true count">
        <Prose>
          <p>
            Start every shoe at zero. Add each card’s tag as it is exposed — including the burn card the dealer shows at the start, but not the cards
            burned face down — to get the <dfn>running count</dfn>. Because a surplus of good cards matters more when fewer cards remain, divide by the
            number of decks still in the shoe to get the <dfn>true count</dfn>; the thresholds above refer to the true count. (The engine, like most
            counters, never divides by less than half a deck.)
          </p>
        </Prose>
        <CountWalkthrough systems={SYSTEMS} />
        <Callout tone="tip" title="At the table">
          Count the cards as they are turned, in pairs if you can (an 8 and a 5 cancel to +1), and estimate the discard pile for decks remaining. The
          hand history in Play mode lists every card so you can check yourself, and the Coach panel shows both counts live.
        </Callout>
      </Section>

      <Section id="worth" number={6} title="What the count is worth">
        <Prose>
          <p>
            The tables below come from the strategy module’s simulation of many thousands of shoes dealt exactly as the engine deals them at the table,
            recording the return of each side bet for every hand by the true count at that moment. Rows at or above the threshold are the hands you would
            bet. The money columns assume the table’s side-bet maximum of {formatMoney(sideMax)}.
          </p>
        </Prose>
        <CountEvTable name="Dragon 7" rows={COUNT_EV.dragon7} threshold={DRAGON7_SYSTEM.threshold} amount={sideMax} />
        <CountEvTable name="Panda 8" rows={COUNT_EV.panda8} threshold={PANDA8_SYSTEM.threshold} amount={sideMax} />
        <Facts
          items={[
            { label: 'Dragon 7 bets placed', value: formatPercent(d7Pooled.frequency, 1), sub: 'of hands dealt' },
            { label: 'Panda 8 bets placed', value: formatPercent(p8Pooled.frequency, 1), sub: 'of hands dealt' },
            { label: 'Both counts, per hour', value: formatMoney(Math.round(bothHourly), { signed: true }), sub: `70 hands/h at ${formatMoney(sideMax)} max`, tone: bothHourly > 0 ? 'positive' : 'negative' },
          ]}
        />
      </Section>

      <Section id="reality" number={7} title="Realistic expectations">
        <Prose>
          <ul>
            <li>
              <strong>The edge is real but thin, and rare.</strong> You bet only on the few percent of hands when the count is high; most of the time you
              sit and count, flat-betting the Banker at its usual cost or not betting at all.
            </li>
            <li>
              <strong>The variance is brutal.</strong> A 40:1 bet that hits one time in {formatNumber(1 / p.dragon7, 0)} on average — even when it is +EV —
              produces losing streaks of hundreds of bets. Expect to need a bankroll of many hundreds of maximum bets to ride them out.
            </li>
            <li>
              <strong>The casino’s rules matter.</strong> The side-bet maximum ({formatMoney(sideMax)} here) caps the gain; a cut card placed{' '}
              {rules.cutCardFromEnd} cards from the end removes the richest part of the shoe; some houses forbid entering the side bets mid-shoe or
              reserve the right to shuffle early.
            </li>
            <li>
              <strong>It is legal, and it is noticed.</strong> Counting is thinking. Casinos may nevertheless ask a player who only bets the Dragon 7 at
              high counts to stop playing it, or to leave.
            </li>
            <li>
              <strong>Compare it with everything else in this course:</strong> it is the only idea here that moves the number in your favour. On the
              simulated figures above it is worth about {formatMoney(Math.round(bothHourly))} an hour at a {formatMoney(sideMax)} maximum — before the
              swings, the hours spent waiting for a high count, and the casino’s countermeasures. Treat it as a fascinating edge, not a living.
            </li>
          </ul>
        </Prose>
        <LinkRow>
          <LinkCard href="#lab" kicker="Strategy Lab">
            Run the “Count Dragon 7” preset
          </LinkCard>
          <LinkCard href="#learn/drills" kicker="Drill">
            Practise the running count
          </LinkCard>
        </LinkRow>
        <Prose>
          <p>
            How the roads fit in: not at all — the count needs the <em>cards</em>, which the roads do not show (<LessonLink to="roads">Lesson 5</LessonLink>).
          </p>
        </Prose>
      </Section>
    </LessonPage>
  );
}

export default CountingLesson;
