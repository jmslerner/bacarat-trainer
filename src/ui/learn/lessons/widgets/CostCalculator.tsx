/**
 * Cost-of-play calculator: bet × hands per hour × hours × house edge, plus the size of a typical swing so the
 * expected loss can be seen next to the noise that hides it.
 */
import { useState, type ReactNode } from 'react';
import { BET_LABELS, BET_TYPES, isBetEnabled, type BetType, type TableRules } from '@/engine';
import { NumberInput, Select, formatMoney, formatNumber, formatPercent } from '@/ui/shell';
import { Facts, Widget, type FactItem } from '../components';
import { sessionExpectation } from '../math';
import styles from './Widgets.module.css';

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, accurate to ~1e-7). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + (x < 0 ? -erf : erf));
}

export interface CostCalculatorProps {
  rules: TableRules;
}

export function CostCalculator({ rules }: CostCalculatorProps): ReactNode {
  const [bet, setBet] = useState<BetType>('banker');
  const [amount, setAmount] = useState(25);
  const [perHour, setPerHour] = useState(70);
  const [hours, setHours] = useState(2);

  const hands = Math.round(perHour * hours);
  const s = sessionExpectation(bet, amount, hands, rules);
  const hourly = sessionExpectation(bet, amount, perHour, rules);
  const mainBet = bet === 'player' || bet === 'banker';
  const pAhead = s.stdDev > 0 ? 1 - normalCdf(-s.expectedNet / s.stdDev) : 0;

  const facts: FactItem[] = [
    { label: 'Hands', value: formatNumber(hands), sub: `${perHour} per hour × ${hours} h` },
    { label: 'Total wagered', value: formatMoney(s.wagered), sub: `${formatMoney(amount)} per hand` },
    { label: 'Expected loss', value: formatMoney(-s.expectedNet), sub: `${formatPercent(s.edge, 2)} of the action`, tone: 'negative' },
    { label: 'Per hour', value: formatMoney(-hourly.expectedNet), sub: 'the price of a seat', tone: 'negative' },
    { label: 'Typical swing', value: `± ${formatMoney(Math.round(s.stdDev))}`, sub: 'one standard deviation', tone: 'gold' },
  ];
  if (mainBet) facts.push({ label: 'Finish ahead', value: formatPercent(pAhead, 0), sub: 'roughly (normal approx.)' });

  const options = BET_TYPES.filter((b) => isBetEnabled(b, rules)).map((b) => ({ value: b, label: BET_LABELS[b] }));

  return (
    <Widget title="Cost of play" hint="Bet × hands × house edge: what a session costs on average." data-widget="cost-calculator">
      <div className={styles.form}>
        <Select<BetType> label="Bet" value={bet} options={options} onChange={setBet} />
        <NumberInput label="Amount per hand" value={amount} onChange={setAmount} min={1} max={100000} step={5} decimals={0} prefix="$" />
        <NumberInput label="Hands per hour" value={perHour} onChange={setPerHour} min={1} max={400} step={10} decimals={0} hint="Full table ~40–70, mini-bac 100+" />
        <NumberInput label="Hours" value={hours} onChange={setHours} min={0.5} max={100} step={0.5} decimals={1} />
      </div>
      <Facts items={facts} />
      <p className={styles.note}>
        The expected loss is small next to the swing — that is exactly why sessions feel random and why the edge only shows up over many hours. Over{' '}
        {formatNumber(hands)} hands the swing is about {s.expectedNet !== 0 ? formatNumber(s.stdDev / Math.abs(s.expectedNet), 1) : '—'}× the expected loss; over 100 times as many hands it
        would be only a tenth of that ratio.
      </p>
    </Widget>
  );
}
