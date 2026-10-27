/**
 * A clickable replica of the Play table: every spot (same names and colours as the real layout) explains what
 * it is, what it pays and what it costs at the active table rules. A guided tour walks through them in order.
 */
import { useState, type ReactNode } from 'react';
import { BET_LABELS, houseEdge, isBetEnabled, limitsFor, outcomeProbabilities, payoutMultiplier, winProbability, type BetType, type TableRules } from '@/engine';
import { Button, Chip, cx, formatMoney, formatOdds, formatPercent } from '@/ui/shell';
import { Facts, Widget, type FactItem } from '../components';
import styles from './TableTour.module.css';

export type TourSpotId = BetType | 'playerArea' | 'bankerArea' | 'shoe' | 'dealer' | 'tray' | 'limits' | 'commission';

const TOUR_ORDER: readonly TourSpotId[] = ['playerArea', 'bankerArea', 'shoe', 'dealer', 'player', 'banker', 'tie', 'playerPair', 'bankerPair', 'dragon7', 'panda8', 'tray', 'limits', 'commission'];

interface SpotText {
  kicker: string;
  title: string;
  text: string;
}

const BET_WINS: Record<BetType, string> = {
  player: 'the Player hand finishes closer to 9 than the Banker hand. A tie returns your bet.',
  banker: 'the Banker hand finishes closer to 9 than the Player hand. A tie returns your bet.',
  tie: 'both hands finish with the same total.',
  dragon7: 'the Banker WINS with a THREE-card total of 7. A two-card 7 or a 7–7 tie does not count.',
  panda8: 'the Player WINS with a THREE-card total of 8. A natural (two-card) 8 or an 8–8 tie does not count.',
  playerPair: 'the Player’s first two cards share a rank (two Kings, two 4s…). It is settled on the initial deal whatever the hand does afterwards.',
  bankerPair: 'the Banker’s first two cards share a rank. Settled on the initial deal, independent of the outcome.',
};

function bankerPayText(rules: TableRules): string {
  switch (rules.bankerRule) {
    case 'ez':
      return 'Pays 1 to 1 with no commission. The catch: when the Banker wins with a three-card 7 (the Dragon 7), Banker bets are a push — the house keeps its edge through those hands instead of a commission.';
    case 'commission':
      return `Pays 1 to 1 minus a ${formatPercent(rules.commissionRate, 0)} commission on every winning Banker bet, taken from the winnings as the hand is paid.`;
    case 'super6':
      return 'Pays 1 to 1 with no commission, except that a Banker win with a total of 6 pays only half (1 to 2).';
  }
}

function spotText(id: TourSpotId, rules: TableRules): SpotText {
  switch (id) {
    case 'playerArea':
      return {
        kicker: 'Card area',
        title: 'PLAYER',
        text: 'The Player hand is dealt here, nearest to the customers, and its total is shown beside it. "Player" is just the name of one of the two hands — you are not the Player, and anyone at the table may bet on either hand.',
      };
    case 'bankerArea':
      return {
        kicker: 'Card area',
        title: 'BANKER',
        text: 'The Banker hand is dealt here. "Banker" is the other hand, not the house: the casino earns its edge from the payouts, not from backing a side. Banker receives its cards second and acts last, which is why it wins slightly more often.',
      };
    case 'shoe':
      return {
        kicker: 'Equipment',
        title: 'The shoe',
        text: `${rules.decks} decks (${rules.decks * 52} cards) are shuffled and placed in the shoe with a cut card ${rules.cutCardFromEnd} cards from the end. When the cut card comes out, the dealer finishes that hand, deals one more, and then shuffles. ${rules.burnProcedure ? 'At the start of a shoe the first card is turned face up and that many cards are burned.' : 'This table skips the burn procedure.'}`,
      };
    case 'dealer':
      return {
        kicker: 'Dealer',
        title: 'The dealer’s calls',
        text: 'The dealer announces everything: "No more bets", "Card to Player", "Player shows 5, Banker shows 3", "Player draws", "Banker stands", "Banker wins, 7 over 5" and the bonus calls "Dragon 7!" and "Panda 8!". You make no decisions after your chips are down — the third-card rules are automatic.',
      };
    case 'tray':
      return {
        kicker: 'Rail',
        title: 'Chip tray',
        text: `Your chips, in US casino colours: $1 white, $5 red, $25 green, $100 black, $500 purple, $1,000 orange ("pumpkin") and $5,000 brown. This table offers ${rules.chipDenominations.map((c) => formatMoney(c)).join(', ')}. Click a chip to pick it up, then click a betting spot to place it; place several to build a stack.`,
      };
    case 'limits':
      return {
        kicker: 'Rail',
        title: 'Table limits plaque',
        text: `Main bets ${formatMoney(rules.limits.main.min)}–${formatMoney(rules.limits.main.max)}, Tie ${formatMoney(rules.limits.tie.min)}–${formatMoney(rules.limits.tie.max)}, side bets ${formatMoney(rules.limits.side.min)}–${formatMoney(rules.limits.side.max)}. The maximum is enforced as you place chips; the minimum is checked when the dealer deals. Your chips on the layout can never exceed your bankroll.`,
      };
    case 'commission':
      return {
        kicker: 'Rail',
        title: 'Commission box',
        text:
          rules.bankerRule === 'commission'
            ? `At a classic table the ${formatPercent(rules.commissionRate, 0)} commission on winning Banker bets is deducted from each payout; the commission box shows what the house has collected.`
            : 'Only classic (commission) tables have one. At this EZ / no-commission table nothing is deducted from Banker payouts, so the box stays empty.',
      };
    default: {
      const bet = id;
      const enabled = isBetEnabled(bet, rules);
      const pays = bet === 'banker' ? bankerPayText(rules) : `Pays ${formatOdds(payoutMultiplier(bet, rules))}.`;
      return {
        kicker: enabled ? 'Betting spot' : 'Betting spot — not dealt at this table',
        title: BET_LABELS[bet].toUpperCase(),
        text: `Wins when ${BET_WINS[bet]} ${pays}`,
      };
    }
  }
}

function betFacts(bet: BetType, rules: TableRules): FactItem[] {
  const enabled = isBetEnabled(bet, rules);
  const limits = limitsFor(bet, rules);
  const pays = bet === 'banker' && rules.bankerRule === 'commission' ? `1:1 − ${formatPercent(rules.commissionRate, 0)}` : formatOdds(payoutMultiplier(bet, rules));
  const items: FactItem[] = [
    { label: 'Pays', value: pays, tone: 'gold' },
    { label: 'Wins', value: formatPercent(winProbability(bet, rules), 2), sub: 'of hands' },
    { label: 'House edge', value: formatPercent(houseEdge(bet, rules), 2), sub: 'of each bet', tone: 'negative' },
    { label: 'Limits', value: `${formatMoney(limits.min)}–${formatMoney(limits.max)}`, sub: enabled ? 'at this table' : 'not offered here' },
  ];
  if (bet === 'player' || bet === 'banker') {
    const push = outcomeProbabilities(bet, rules).push;
    items.splice(2, 0, { label: 'Pushes', value: formatPercent(push, 2), sub: bet === 'banker' && rules.bankerRule === 'ez' ? 'tie or Dragon 7' : 'on a tie' });
  }
  return items;
}

export interface TableTourProps {
  rules: TableRules;
}

export function TableTour({ rules }: TableTourProps): ReactNode {
  const [selected, setSelected] = useState<TourSpotId | null>(null);
  const tourIndex = selected === null ? -1 : TOUR_ORDER.indexOf(selected);
  const info = selected === null ? null : spotText(selected, rules);
  const isBet = (id: TourSpotId | null): id is BetType => id !== null && id in BET_LABELS;

  const step = (delta: number): void => {
    const next = tourIndex < 0 ? 0 : (tourIndex + delta + TOUR_ORDER.length) % TOUR_ORDER.length;
    setSelected(TOUR_ORDER[next]);
  };

  const spot = (id: TourSpotId, label: ReactNode, className: string, odds?: ReactNode, off?: boolean): ReactNode => (
    <button
      type="button"
      className={cx(className, selected === id && styles.selected, off && styles.off)}
      aria-pressed={selected === id}
      data-spot={id}
      onClick={() => setSelected(id)}
    >
      {label}
      {odds !== undefined && <span className={styles.odds}>{odds}</span>}
    </button>
  );

  return (
    <Widget
      title="Table layout tour"
      hint="Click any part of the table, or take the guided tour."
      data-widget="table-tour"
      actions={
        <div className={styles.tour}>
          <Button size="sm" variant={selected === null ? 'primary' : 'secondary'} onClick={() => step(tourIndex < 0 ? 0 : 1)}>
            {selected === null ? 'Start tour' : 'Next'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => step(-1)} disabled={selected === null}>
            Previous
          </Button>
          <span className={styles.tourCount} aria-live="polite">
            {selected === null ? `${TOUR_ORDER.length} stops` : `${tourIndex + 1} / ${TOUR_ORDER.length}`}
          </span>
        </div>
      }
    >
      <div className={styles.table}>
        <div className={styles.felt} role="group" aria-label="Table layout">
          <div className={styles.hands}>
            {spot('playerArea', 'Player', cx(styles.area, styles.playerArea), 'cards & total')}
            <button type="button" className={cx(styles.shoe, selected === 'shoe' && styles.selected)} aria-pressed={selected === 'shoe'} data-spot="shoe" onClick={() => setSelected('shoe')}>
              <span className={styles.shoeCards} aria-hidden="true">
                <span className={styles.shoeCard} />
                <span className={styles.shoeCard} />
                <span className={styles.shoeCard} />
                <span className={styles.cutCard} />
              </span>
              <span>
                Shoe · {rules.decks} decks
              </span>
            </button>
            {spot('bankerArea', 'Banker', cx(styles.area, styles.bankerArea), 'cards & total')}
          </div>
          {spot('dealer', '"No more bets" — the dealer’s calls', styles.dealer)}
          <div className={styles.sideSpots}>
            {spot('dragon7', 'Dragon 7', cx(styles.spot, styles.spotDragon), `pays ${rules.dragon7Pays} to 1`, !rules.sideBets.dragon7)}
            {spot('panda8', 'Panda 8', cx(styles.spot, styles.spotPanda), `pays ${rules.panda8Pays} to 1`, !rules.sideBets.panda8)}
          </div>
          <div className={styles.spots}>
            {spot('playerPair', 'Player Pair', cx(styles.spot, styles.spotPlayer), `${rules.pairPays} to 1`, !rules.sideBets.pairs)}
            {spot('player', 'Player', cx(styles.spot, styles.spotPlayer), '1 to 1')}
            {spot('tie', 'Tie', cx(styles.spot, styles.spotTie), `${rules.tiePays} to 1`)}
            {spot('banker', 'Banker', cx(styles.spot, styles.spotBanker), rules.bankerRule === 'ez' ? 'no commission' : rules.bankerRule === 'commission' ? `${formatPercent(rules.commissionRate, 0)} commission` : 'Super 6')}
            {spot('bankerPair', 'Banker Pair', cx(styles.spot, styles.spotBanker), `${rules.pairPays} to 1`, !rules.sideBets.pairs)}
          </div>
        </div>
        <div className={styles.rail}>
          <button type="button" className={cx(styles.railBtn, selected === 'tray' && styles.selected)} aria-pressed={selected === 'tray'} data-spot="tray" onClick={() => setSelected('tray')}>
            <span className={styles.chips} aria-hidden="true">
              {rules.chipDenominations.slice(0, 6).map((v) => (
                <Chip key={v} value={v} size="xs" />
              ))}
            </span>
            <span>Chip tray</span>
          </button>
          {spot('limits', `Min ${formatMoney(rules.limits.main.min)} — Max ${formatMoney(rules.limits.main.max)}`, styles.railBtn)}
          {spot('commission', rules.bankerRule === 'commission' ? 'Commission box' : 'Commission box (none)', cx(styles.railBtn, styles.commission), undefined, rules.bankerRule !== 'commission')}
        </div>
      </div>

      <div className={styles.desc} aria-live="polite" data-tour-desc>
        {info === null ? (
          <p className={styles.descText}>
            The table has three kinds of places: the <strong>card areas</strong> at the top where the two hands are dealt, the <strong>betting spots</strong> along the
            bottom where your chips go, and the <strong>rail</strong> with your chips and the limits plaque. Pick one to learn what it does.
          </p>
        ) : (
          <>
            <div className={styles.descHead}>
              <span className={styles.descKicker}>{info.kicker}</span>
              <h3 className={styles.descTitle}>{info.title}</h3>
            </div>
            <p className={styles.descText}>{info.text}</p>
            {isBet(selected) && <Facts items={betFacts(selected, rules)} />}
          </>
        )}
      </div>
    </Widget>
  );
}
