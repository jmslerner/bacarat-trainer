/**
 * Every bet at the active table with its payout, exact win/push probabilities and house edge, straight from
 * the engine's exact probabilities and the table's actual payouts.
 */
import type { ReactNode } from 'react';
import { BET_LABELS, BET_TYPES, houseEdge, isBetEnabled, outcomeProbabilities, payoutMultiplier, type BetType, type TableRules } from '@/engine';
import { cx, formatMoney, formatOdds, formatPercent } from '@/ui/shell';
import { Table, tableClass } from '../components';

const WINS_WHEN: Record<BetType, string> = {
  player: 'Player total beats Banker total',
  banker: 'Banker total beats Player total',
  tie: 'Both totals are equal',
  dragon7: 'Banker wins with a three-card 7',
  panda8: 'Player wins with a three-card 8',
  playerPair: 'Player’s first two cards are a pair',
  bankerPair: 'Banker’s first two cards are a pair',
};

export function payoutLabel(bet: BetType, rules: TableRules): string {
  if (bet === 'banker') {
    switch (rules.bankerRule) {
      case 'ez':
        return '1:1, push on Dragon 7';
      case 'commission':
        return `1:1 less ${formatPercent(rules.commissionRate, 0)}`;
      case 'super6':
        return '1:1 (1:2 on a Banker 6)';
    }
  }
  return formatOdds(payoutMultiplier(bet, rules));
}

export interface PayoutTableProps {
  rules: TableRules;
  /** Amount used for the "cost per bet" column (default $100). */
  stake?: number;
}

export function PayoutTable({ rules, stake = 100 }: PayoutTableProps): ReactNode {
  return (
    <Table caption={`Bets at this table (${rules.decks} decks)`}>
      <thead>
        <tr>
          <th scope="col">Bet</th>
          <th scope="col" className={tableClass.phoneHidden}>
            Wins when
          </th>
          <th scope="col">Pays</th>
          <th scope="col" className={tableClass.num}>
            Wins
          </th>
          <th scope="col" className={tableClass.num}>
            Pushes
          </th>
          <th scope="col" className={tableClass.num}>
            House edge
          </th>
          <th scope="col" className={tableClass.num}>
            Costs per {formatMoney(stake)}
          </th>
        </tr>
      </thead>
      <tbody>
        {BET_TYPES.map((bet) => {
          const enabled = isBetEnabled(bet, rules);
          const p = outcomeProbabilities(bet, rules);
          const edge = houseEdge(bet, rules);
          return (
            <tr key={bet} className={cx(!enabled && tableClass.dim)} data-bet={bet}>
              <td className={tableClass.strong}>
                {BET_LABELS[bet]}
                {!enabled && <span className={tableClass.muted}> (not dealt here)</span>}
              </td>
              <td className={tableClass.phoneHidden}>{WINS_WHEN[bet]}</td>
              <td>{payoutLabel(bet, rules)}</td>
              <td className={tableClass.num}>{formatPercent(p.win, 2)}</td>
              <td className={cx(tableClass.num, p.push === 0 && tableClass.muted)}>{p.push === 0 ? '—' : formatPercent(p.push, 2)}</td>
              <td className={tableClass.num} data-edge={bet}>
                {formatPercent(edge, 2)}
              </td>
              <td className={tableClass.num}>{formatMoney(edge * stake, { cents: true })}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
