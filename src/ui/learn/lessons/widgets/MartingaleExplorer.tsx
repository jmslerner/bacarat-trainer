/**
 * The arithmetic of doubling after a loss at a table with a maximum: how many doublings fit, how often the
 * sequence busts, and what it costs when it does.
 */
import { useState, type ReactNode } from 'react';
import { outcomeProbabilities, type Side, type TableRules } from '@/engine';
import { NumberInput, Select, formatMoney, formatNumber, formatPercent } from '@/ui/shell';
import { Facts, Widget } from '../components';
import { martingaleStats } from '../math';
import styles from './Widgets.module.css';

export interface MartingaleExplorerProps {
  rules: TableRules;
  /** Hands per hour, for the "time until it bites" line. */
  handsPerHour?: number;
}

export function MartingaleExplorer({ rules, handsPerHour = 70 }: MartingaleExplorerProps): ReactNode {
  const [unit, setUnit] = useState(rules.limits.main.min);
  const [max, setMax] = useState(rules.limits.main.max);
  const [side, setSide] = useState<Side>('player');
  const p = outcomeProbabilities(side, rules);
  const m = martingaleStats(unit, max, p.win, p.lose);
  const resolvedShare = p.win + p.lose;
  const handsDealtPerBust = m.handsPerBust / Math.max(resolvedShare, 1e-9);
  const hoursPerBust = handsDealtPerBust / handsPerHour;

  return (
    <Widget title="Martingale, with a table maximum" hint="Double after every loss until you win one unit… or hit the maximum." data-widget="martingale-explorer">
      <div className={styles.form}>
        <NumberInput label="Starting bet" value={unit} onChange={setUnit} min={1} max={1000000} step={5} decimals={0} prefix="$" />
        <NumberInput label="Table maximum" value={max} onChange={setMax} min={1} max={10000000} step={100} decimals={0} prefix="$" />
        <Select<Side>
          label="Bet on"
          value={side}
          onChange={setSide}
          options={[
            { value: 'player', label: 'Player' },
            { value: 'banker', label: 'Banker' },
          ]}
        />
      </div>
      <div className={styles.pills} aria-label="Bet sequence">
        {m.sequence.map((b, i) => (
          <span key={i} className={styles.pill}>
            <strong>{formatMoney(b)}</strong>
          </span>
        ))}
        {m.sequence.length > 0 && (
          <span className={styles.pill}>
            next would be {formatMoney(m.sequence[m.sequence.length - 1] * 2)} — over the maximum
          </span>
        )}
      </div>
      <Facts
        items={[
          { label: 'Bets before the cap', value: String(m.steps), sub: `${Math.max(0, m.steps - 1)} doublings` },
          { label: 'Each sequence wins', value: formatMoney(unit), sub: `${formatPercent(1 - m.bustProb, 2)} of the time`, tone: 'positive' },
          { label: 'A sequence busts', value: formatPercent(m.bustProb, 2), sub: `${m.steps} losses in a row`, tone: 'negative' },
          { label: 'Cost of a bust', value: formatMoney(m.bustLoss), sub: 'all the chips in the sequence', tone: 'negative' },
          { label: 'Busts about every', value: `${formatNumber(hoursPerBust, 0)} h`, sub: `${formatNumber(handsDealtPerBust, 0)} hands at ${handsPerHour}/h` },
          { label: 'Expected per sequence', value: formatMoney(m.expectedPerSequence, { signed: true, cents: true }), sub: 'the house edge, rearranged', tone: 'negative' },
        ]}
      />
      <p className={styles.note}>
        Between busts the system wins {formatMoney(unit)} about {formatNumber(m.sequencesPerBust, 0)} times — roughly {formatMoney(Math.round(unit * m.sequencesPerBust))} — and then
        loses {formatMoney(m.bustLoss)} in one go. The small wins and the rare disaster add up to the same expected loss as flat betting the same total action.
      </p>
    </Widget>
  );
}
