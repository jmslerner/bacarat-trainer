/**
 * How often the Dragon 7 and Panda 8 hit, what a fair payout would be, and what a run of side bets costs.
 */
import { useState, type ReactNode } from 'react';
import { exactProbabilities, houseEdge, type TableRules } from '@/engine';
import { NumberInput, cx, formatMoney, formatNumber, formatOdds, formatPercent } from '@/ui/shell';
import { Table, Widget, tableClass } from '../components';
import { fairOdds, handsPerHit, probAtLeastOne, sessionExpectation } from '../math';
import styles from './Widgets.module.css';

export interface BonusOddsProps {
  rules: TableRules;
}

export function BonusOdds({ rules }: BonusOddsProps): ReactNode {
  const [hands, setHands] = useState(100);
  const [amount, setAmount] = useState(rules.limits.side.min);
  const p = exactProbabilities(rules.decks);
  const rows = [
    { bet: 'dragon7' as const, name: 'Dragon 7', prob: p.dragon7, pays: rules.dragon7Pays },
    { bet: 'panda8' as const, name: 'Panda 8', prob: p.panda8, pays: rules.panda8Pays },
  ];
  return (
    <Widget title="How often do they hit?" hint="The bonuses are rare by design; the payout is what makes them look generous." data-widget="bonus-odds">
      <div className={styles.form}>
        <NumberInput label="Hands played" value={hands} onChange={setHands} min={1} max={100000} step={10} decimals={0} />
        <NumberInput label="Side bet per hand" value={amount} onChange={setAmount} min={1} max={100000} step={5} decimals={0} prefix="$" />
      </div>
      <Table compact>
        <thead>
          <tr>
            <th scope="col">Bet</th>
            <th scope="col" className={tableClass.num}>
              Per hand
            </th>
            <th scope="col" className={tableClass.num}>
              Once every
            </th>
            <th scope="col" className={tableClass.num}>
              Expected in {formatNumber(hands)}
            </th>
            <th scope="col" className={tableClass.num}>
              At least one
            </th>
            <th scope="col" className={tableClass.num}>
              Fair payout
            </th>
            <th scope="col" className={tableClass.num}>
              Actual
            </th>
            <th scope="col" className={tableClass.num}>
              Expected result
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = sessionExpectation(r.bet, amount, hands, rules);
            return (
              <tr key={r.bet} data-bonus={r.bet}>
                <td className={tableClass.strong}>{r.name}</td>
                <td className={tableClass.num}>{formatPercent(r.prob, 2)}</td>
                <td className={tableClass.num}>{formatNumber(handsPerHit(r.prob), 1)} hands</td>
                <td className={tableClass.num}>{formatNumber(r.prob * hands, 2)} hits</td>
                <td className={tableClass.num}>{formatPercent(probAtLeastOne(r.prob, hands), 1)}</td>
                <td className={tableClass.num}>{formatOdds(Math.round(fairOdds(r.prob) * 10) / 10)}</td>
                <td className={tableClass.num}>{formatOdds(r.pays)}</td>
                <td className={cx(tableClass.num, s.expectedNet < 0 ? 'c-loss' : 'c-win')}>
                  {formatMoney(s.expectedNet, { signed: true })} <span className={tableClass.muted}>({formatPercent(houseEdge(r.bet, rules), 2)} edge)</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className={styles.note}>
        &ldquo;Once every {formatNumber(handsPerHit(p.dragon7), 0)} hands&rdquo; is an average, not a schedule: in {formatNumber(handsPerHit(p.dragon7), 0)} hands the
        chance of seeing at least one Dragon 7 is only about {formatPercent(probAtLeastOne(p.dragon7, Math.round(handsPerHit(p.dragon7))), 0)}, and about one
        gap in {formatNumber(1 / Math.pow(1 - p.dragon7, 100), 0)} runs past 100 hands without one.
      </p>
    </Widget>
  );
}
